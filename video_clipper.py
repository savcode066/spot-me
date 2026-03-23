import cv2
import easyocr
from fuzzywuzzy import fuzz
import numpy as np
from pathlib import Path
import ffmpeg
import yt_dlp
from typing import List, Tuple, Union
import logging
from datetime import timedelta
import os
import torch

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Check GPU availability
def check_gpu():
    """Check if CUDA/GPU is available and log results."""
    has_cuda = torch.cuda.is_available()
    if has_cuda:
        gpu_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0)
        logger.info(f"✓ CUDA is available! GPU detected: {gpu_name}")
        logger.info(f"  Total GPUs: {gpu_count}")
        logger.info(f"  CUDA Version: {torch.version.cuda}")
        return True
    else:
        logger.warning("⚠ CUDA not available - will use CPU (slower)")
        return False

class VideoClipper:
    def __init__(self, clip_duration: int = 30, use_gpu: bool = True):
        """
        Initialize the VideoClipper with parameters.

        Args:
            clip_duration: Duration of output clips in seconds
            use_gpu: Whether to use GPU for OCR (if available)
        """

        self.clip_duration = clip_duration
        self.use_gpu = use_gpu and torch.cuda.is_available()

        # Initialize EasyOCR
        logger.info("Initializing EasyOCR reader...")
        if self.use_gpu:
            logger.info("Loading EasyOCR with GPU support...")
            self.ocr = easyocr.Reader(['en'], gpu=True)
            logger.info("✓ EasyOCR loaded on GPU")
        else:
            logger.info("Loading EasyOCR with CPU only...")
            self.ocr = easyocr.Reader(['en'], gpu=False)
            logger.info("✓ EasyOCR loaded on CPU")
        
    def download_youtube_video(self, url: str, output_path: str) -> str:
        """Download video from YouTube URL using yt-dlp."""
        logger.info(f"Downloading YouTube video: {url}")
        ydl_opts = {
            'format': 'best[ext=mp4]',
            'outtmpl': output_path,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        logger.info(f"✓ Downloaded to: {output_path}")
        return output_path

    def get_video_path(self, video_source: str) -> str:
        """Handle both local files and YouTube URLs."""
        if video_source.startswith(('http://', 'https://')):
            output_path = f"temp_video_{hash(video_source)}.mp4"
            return self.download_youtube_video(video_source, output_path)
        return video_source

    def sample_frames(self, video_path: str) -> List[Tuple[float, np.ndarray]]:
        """
        Sample frames from video at 1 FPS.
        
        Returns:
            List of tuples containing (timestamp, frame)
        """
        logger.info(f"Extracting frames from {video_path} at 1 FPS...")
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps)  # Sample every second
        
        frames = []
        frame_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_count % frame_interval == 0:
                timestamp = frame_count / fps
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append((timestamp, frame_rgb))
                
            frame_count += 1
            
        cap.release()
        logger.info(f"Successfully extracted {len(frames)} frames.")
        return frames

    def find_text_segments(self, video_path: str, search_text: str) -> List[Tuple[float, float]]:
        """
        Find segments where search text appears in video via OCR.

        Returns:
            List of (start_time, end_time) tuples
        """
        # Sample frames from video
        frames = self.sample_frames(video_path)

        # Find matching segments
        similar_segments = []
        current_segment = None
        search_text_lower = search_text.lower()

        total_frames = len(frames)
        logger.info(f"Starting OCR on {total_frames} extracted frames...")
        logger.info(f"Searching for text: '{search_text}'")

        matches_found = 0
        for i, (timestamp, frame) in enumerate(frames):
            if i % 10 == 0 or i == total_frames - 1:
                logger.info(f"  Scanning frame {i+1}/{total_frames} (Time: {timedelta(seconds=int(timestamp))})")

            # EasyOCR expects BGR
            bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

            # Preprocess for better OCR on blurry text
            # Convert to grayscale
            gray = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2GRAY)
            # Increase contrast mildly
            gray = cv2.convertScaleAbs(gray, alpha=1.2, beta=10)
            # Resize up for better detection of small text
            gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

            result = self.ocr.readtext(gray)

            extracted_texts = []
            for detection in result:
                bbox, text, confidence = detection
                if confidence > 0.5:
                    extracted_texts.append(text.lower())

            logger.info(f"  OCR [{timedelta(seconds=int(timestamp))}]: {extracted_texts if extracted_texts else '(nothing detected)'}")

            # Check for fuzzy match
            match_found = any(fuzz.partial_ratio(search_text_lower, t) > 80 for t in extracted_texts)

            if match_found:
                matches_found += 1
                logger.info(f"  ✓ Match found at {timedelta(seconds=int(timestamp))}")
                if current_segment is None:
                    current_segment = (timestamp, timestamp)
                else:
                    current_segment = (current_segment[0], timestamp)
            elif current_segment is not None:
                similar_segments.append(current_segment)
                current_segment = None

        if current_segment is not None:
            similar_segments.append(current_segment)

        logger.info(f"✓ OCR complete. Found {matches_found} matching frames in {len(similar_segments)} segment(s)")
        return similar_segments

    def clip_video_segments(self, video_path: str, segments: List[Tuple[float, float]], output_folder: str):
        """Create video clips for each similar segment."""
        os.makedirs(output_folder, exist_ok=True)
        logger.info(f"Creating {len(segments)} clip(s) in '{output_folder}'...")

        for i, (start_time, end_time) in enumerate(segments):
            # Add padding around the segment
            start_time = max(0, start_time - self.clip_duration/2)
            duration = self.clip_duration

            output_path = os.path.join(output_folder, f"clip_{i+1}.mp4")

            try:
                logger.info(f"  Creating clip {i+1}/{len(segments)}: {timedelta(seconds=int(start_time))} → {timedelta(seconds=int(start_time+duration))}")
                stream = ffmpeg.input(video_path, ss=start_time, t=duration)
                stream = ffmpeg.output(stream, output_path)
                ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)
                logger.info(f"  ✓ Created: {output_path}")
            except ffmpeg.Error as e:
                logger.error(f"  ✗ Error creating clip {i+1}: {e.stderr.decode()}")

        logger.info(f"✓ All clips created successfully!")

def format_timestamp(seconds: float) -> str:
    return str(timedelta(seconds=int(seconds)))

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Find timestamps where text appears in a video")
    parser.add_argument("video_source", help="Path to video file or YouTube URL")
    parser.add_argument("search_text", help="Text to search for in the video")
    parser.add_argument("--cpu-only", action="store_true", help="Force CPU-only mode (ignore GPU)")

    args = parser.parse_args()

    # Check GPU availability
    has_gpu = check_gpu()
    use_gpu = has_gpu and not args.cpu_only

    logger.info("=" * 60)
    logger.info("Video Clipper Started")
    logger.info("=" * 60)
    logger.info(f"Video source: {args.video_source}")
    logger.info(f"Search text: '{args.search_text}'")
    logger.info(f"Processing mode: {'GPU' if use_gpu else 'CPU'}")
    logger.info("=" * 60)

    clipper = VideoClipper(use_gpu=use_gpu)

    # Get video path (download if YouTube URL)
    video_path = clipper.get_video_path(args.video_source)

    try:
        segments = clipper.find_text_segments(video_path, args.search_text)

        logger.info("=" * 60)
        if not segments:
            logger.info("No occurrences found.")
            return

        logger.info(f"'{args.search_text}' found at:")
        results = []
        for start, end in segments:
            if int(start) == int(end):
                results.append(format_timestamp(start))
            else:
                results.append(f"{format_timestamp(start)} - {format_timestamp(end)}")

        for r in results:
            logger.info(f"  {r}")
        logger.info("=" * 60)

    finally:
        if video_path != args.video_source and os.path.exists(video_path):
            os.remove(video_path)

if __name__ == "__main__":
    main() 