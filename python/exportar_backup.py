"""Exporta a planilha inteira para CSV e XLSX como backup.

Uso:
    python exportar_backup.py [pasta_saida]
"""

import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

from sheets_client import listar_registros


def exportar(pasta_saida="backups"):
    registros = listar_registros()
    df = pd.DataFrame(registros)

    pasta = Path(pasta_saida)
    pasta.mkdir(parents=True, exist_ok=True)

    marcador = datetime.now().strftime("%Y%m%d_%H%M%S")
    caminho_csv = pasta / f"backup_provas_{marcador}.csv"
    caminho_xlsx = pasta / f"backup_provas_{marcador}.xlsx"

    df.to_csv(caminho_csv, index=False, encoding="utf-8-sig")
    df.to_excel(caminho_xlsx, index=False)

    print(f"{len(df)} registro(s) exportado(s).")
    print(f"CSV:  {caminho_csv}")
    print(f"XLSX: {caminho_xlsx}")


if __name__ == "__main__":
    pasta = sys.argv[1] if len(sys.argv) > 1 else "backups"
    exportar(pasta)
