# Word sign data

Training data for the whole-word signs (`train_words.py` → `model/words.json`).

- `words_<name>_<date>.csv`: recorded by the team in `words-recorder.html`.
- `laplaces42.csv`: starter data for HELLO, THANK YOU, PLEASE, SORRY, and WELCOME. It was converted by
  `tools/import_laplaces_words.py` from `sign_language.csv` in
  [laplaces42/sign-language-interpreter](https://github.com/laplaces42/sign-language-interpreter).
  All of it comes from one signer, so record your own clips too.
- `wlasl.csv`: YES, NO, and EAT, made by `tools/import_wlasl_words.py` from
  [WLASL](https://dxli94.github.io/WLASL/) videos (many signers, one video each).
  Only hand landmarks are kept, never the video. WLASL is licensed under the
  Computational Use of Data Agreement (C-UDA): academic and computational use only,
  no commercial use. Cite Li et al., "Word-level Deep Sign Language Recognition from
  Video: A New Large-scale Dataset and Methods Comparison", WACV 2020.

Each row is one 0.8-second clip: `person`, `label`, then `w0`–`w659` (15 frames × 44 numbers; see `js/signs.js`).

## License of the converted data

```
MIT License

Copyright (c) 2024 LaPlace Sallis IV

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
