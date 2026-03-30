"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm() {
  const [username, setUsername] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    router.push(`/scanning?username=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative group">
        {/* Focus glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-container to-tertiary opacity-10 blur group-focus-within:opacity-30 transition-opacity" />

        <div className="relative flex flex-col md:flex-row gap-0">
          {/* Input */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#FF4655] opacity-50">
                person_search
              </span>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-container-low/80 backdrop-blur-md border-none text-on-background placeholder:text-on-surface/30 font-headline font-bold text-xl uppercase py-5 pl-14 pr-6 focus:ring-0 focus:outline-none transition-all"
              placeholder="RIOT USERNAME"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="bg-primary-container hover:bg-primary transition-all duration-300 text-on-primary-fixed px-12 py-6 md:py-0 flex items-center justify-center"
          >
            <span className="font-label font-black text-xl uppercase tracking-tighter">
              Initiate Scan
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
