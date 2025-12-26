#!/usr/bin/env /opt/homebrew/bin/python3
"""
Local Whisper transcription script using faster-whisper
Usage: python3 scripts/transcribe_local.py <audio_file_path> [language]
"""
import sys
import json
import os

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({
        "error": "faster-whisper is not installed",
        "code": "DEPENDENCY_ERROR",
        "details": "Please install faster-whisper: pip install faster-whisper"
    }), file=sys.stderr)
    sys.exit(1)

def transcribe_audio(audio_path: str, language: str = "ja"):
    """Transcribe audio file using faster-whisper"""
    try:
        # Check if file exists
        if not os.path.exists(audio_path):
            return {
                "error": "Audio file not found",
                "code": "FILE_NOT_FOUND",
                "details": f"File path: {audio_path}"
            }
        
        # Initialize model (use CPU if CUDA is not available)
        device = "cuda" if os.environ.get("USE_GPU", "false").lower() == "true" else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        
        model_size = os.environ.get("WHISPER_MODEL_SIZE", "small")
        print(f"[transcribe_local] Loading model: {model_size} on {device}", file=sys.stderr)
        
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
        # Transcribe
        print(f"[transcribe_local] Transcribing: {audio_path}", file=sys.stderr)
        segments, info = model.transcribe(audio_path, language=language if language != "auto" else None)
        
        # Convert to Whisper API format
        result = {
            "task": "transcribe",
            "language": info.language,
            "duration": info.duration,
            "text": "",
            "segments": []
        }
        
        full_text_parts = []
        for segment in segments:
            segment_data = {
                "id": len(result["segments"]),
                "seek": 0,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
                "tokens": [],
                "temperature": 0.0,
                "avg_logprob": -0.5,
                "compression_ratio": 1.0,
                "no_speech_prob": 0.0
            }
            result["segments"].append(segment_data)
            full_text_parts.append(segment.text.strip())
        
        result["text"] = " ".join(full_text_parts)
        
        return result
        
    except Exception as e:
        return {
            "error": "Transcription failed",
            "code": "TRANSCRIPTION_ERROR",
            "details": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Missing audio file path",
            "code": "INVALID_ARGUMENTS",
            "details": "Usage: python3 transcribe_local.py <audio_file_path> [language]"
        }), file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "ja"
    
    result = transcribe_audio(audio_path, language)
    
    if "error" in result:
        print(json.dumps(result), file=sys.stderr)
        sys.exit(1)
    else:
        print(json.dumps(result))
        sys.exit(0)


