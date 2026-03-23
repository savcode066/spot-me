# Video Clipper

A Python tool that finds and clips segments of a video where specific text appears on screen, using OCR (`easyocr`).

## Features

- Process local video files or YouTube URLs
- Sample video frames at 1 FPS
- Use `easyocr` for Optical Character Recognition (OCR) text detection
- Fuzzy text matching for flexible search (80%+ similarity threshold)
- Automatically clip segments around matching frames
- CPU-only operation
- Command-line interface

## Requirements

- Python 3.7+
- FFmpeg installed on your system
- Required Python packages (see requirements.txt)

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd video-clipper
```

2. Install external dependencies (FFmpeg):
- **Windows**:
  - FFmpeg: Download from https://ffmpeg.org/download.html
- **Linux**: `sudo apt-get install ffmpeg`
- **macOS**: `brew install ffmpeg`

3. Create a virtual environment (recommended):
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

4. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

```bash
python video_clipper.py <video_source> "<search_text>" <output_folder> [--duration DURATION]
```

Arguments:
- `video_source`: Path to video file or YouTube URL
- `search_text`: Text to search for in the video
- `output_folder`: Folder to save output clips
- `--duration`: Duration of output clips in seconds (default: 30)

Example:
```bash
# Process a local video file
python video_clipper.py input.mp4 "Hello World" output_clips

# Process a YouTube video
python video_clipper.py "https://www.youtube.com/watch?v=example" "Score: 100" output_clips

# Custom duration
python video_clipper.py input.mp4 "Target Text" output_clips --duration 45
```

## Notes

- The script runs entirely on CPU
- Processing time depends on video length and system performance
- Text matching uses fuzzy string matching (80%+ similarity) for flexible search
- EasyOCR may download language models on first run (~100MB for English)
- Make sure you're in the virtual environment before running the script