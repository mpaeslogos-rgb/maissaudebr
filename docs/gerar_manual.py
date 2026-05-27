"""
Converte o manual.html para PDF usando o Chrome/Edge (headless).
Alternativa: abre o HTML no browser para imprimir como PDF.
"""
import subprocess, os, sys, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(BASE, "manual.html")
PDF  = os.path.join(BASE, "Manual_MaisSaude_BR.pdf")

# ── Tenta Chrome headless ──────────────────────────────────────────────────
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

browser = next((p for p in CHROME_PATHS if os.path.exists(p)), None)

if browser:
    print(f"Usando: {browser}")
    result = subprocess.run([
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--print-to-pdf=" + PDF,
        "--print-to-pdf-no-header",
        "--no-margins",
        HTML,
    ], capture_output=True, text=True, timeout=30)
    if os.path.exists(PDF):
        print("PDF gerado: " + PDF)
    else:
        print("Falha ao gerar PDF via browser headless.")
        print(result.stderr[:500])
else:
    print("Chrome/Edge nao encontrado no caminho padrao.")
    print("Abra o arquivo manual.html no navegador e use Ctrl+P -> Salvar como PDF")
    # Abre o arquivo no browser padrão
    os.startfile(HTML)
