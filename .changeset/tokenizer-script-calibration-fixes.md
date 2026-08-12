---
"token-chunk": patch
"chat-fit": patch
---

Fix the bundled approximate tokenizer (`@llm-kit/tokenizer`) under-counting real BPE tokenization on several content shapes: unbroken non-word Latin runs over ~20 characters (minified identifiers, hashes, base64 blobs), most non-Latin/non-Cyrillic alphabetic scripts (Greek, Hebrew, Arabic, Georgian, Armenian, Thai, Devanagari, and others — previously charged Cyrillic's lighter rate without being individually verified), and multi-code-point CJK grapheme clusters (most commonly NFD-decomposed Hangul). Also fixes an isolated space being assumed to fold before any alphabetic letter, which was only ever verified against Latin script and does not hold reliably for Cyrillic or the other affected scripts. Token counts for content in these shapes are now higher (more conservative); ordinary Latin prose, code, Cyrillic text, and ordinarily-composed CJK text are unaffected.
