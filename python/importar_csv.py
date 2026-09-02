"""Importa registros em lote de um CSV para a planilha.

CSV esperado com colunas: aluno,serie,prova,motivo,pago,observacoes
(opcional: alunoId, com o RA do aluno no Azure — se ausente, fica em branco)
'pago' aceita SIM/NAO (vazio = NAO).

Uso:
    python importar_csv.py caminho/arquivo.csv
"""

import csv
import sys
import uuid
from datetime import datetime

from sheets_client import conectar_planilha, obter_aba_registros

CAMPOS_OBRIGATORIOS = ["aluno", "serie", "prova", "motivo"]


def importar(caminho_csv):
    with open(caminho_csv, newline="", encoding="utf-8-sig") as arquivo:
        leitor = csv.DictReader(arquivo)
        linhas = list(leitor)

    for numero, linha in enumerate(linhas, start=2):
        faltando = [campo for campo in CAMPOS_OBRIGATORIOS if not linha.get(campo, "").strip()]
        if faltando:
            raise ValueError(f"Linha {numero}: faltando campo(s) {', '.join(faltando)}")

    planilha = conectar_planilha()
    aba = obter_aba_registros(planilha)

    agora = datetime.now().isoformat()
    linhas_planilha = []
    for linha in linhas:
        pago = linha.get("pago", "").strip().upper()
        linhas_planilha.append([
            str(uuid.uuid4()),
            linha.get("alunoId", "").strip(),
            linha["aluno"].strip(),
            linha["serie"].strip(),
            linha["prova"].strip(),
            linha["motivo"].strip(),
            "SIM" if pago == "SIM" else "NAO",
            linha.get("observacoes", "").strip(),
            agora,
            agora,
        ])

    aba.append_rows(linhas_planilha, value_input_option="USER_ENTERED")
    print(f"{len(linhas_planilha)} registro(s) importado(s).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python importar_csv.py caminho/arquivo.csv")
        sys.exit(1)
    importar(sys.argv[1])
