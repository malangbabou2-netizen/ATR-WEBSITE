"""Install the fixed EN→FR Argos model, then run a genuine translation smoke test."""
import hashlib
import os
import urllib.request
import time
import shutil
from pathlib import Path
import argostranslate.package
import argostranslate.translate

MODEL_URL = 'https://argos-net.com/v1/translate-en_fr-1_9.argosmodel'
# Digest recorded after downloading and inspecting the upstream package.
MODEL_SHA256 = '3a65ed83364f4e7b06e30f9dd823db1934899ed3ce839e63f46dc7b09dc797b4'

def setup():
    languages = argostranslate.translate.get_installed_languages()
    if not any(language.code == 'en' and any(t.to_lang.code == 'fr' for t in language.translations_from) for language in languages):
        target = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'atr-en-fr.argosmodel'
        # Use the same identification as the official Argos downloader.
        request = urllib.request.Request(MODEL_URL, headers={'User-Agent': 'ArgosTranslate'})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=120) as response, target.open('wb') as output:
                    shutil.copyfileobj(response, output)
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(2 ** attempt)
        if hashlib.sha256(target.read_bytes()).hexdigest() != MODEL_SHA256:
            raise ValueError('Empreinte du modèle Argos inattendue')
        argostranslate.package.install_from_path(target)
    sample = 'Motorcycle riders travel together. Wear a helmet and check your brakes before every ride.'
    result = argostranslate.translate.translate(sample, 'en', 'fr')
    if not result or result == sample or 'casque' not in result.casefold():
        raise RuntimeError('Échec de la traduction anglais-français')
    print(result)

if __name__ == '__main__': setup()
