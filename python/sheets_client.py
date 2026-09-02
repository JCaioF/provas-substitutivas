"""Client comum de conexão com a planilha de Provas Substitutivas."""

import os

import gspread
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials

load_dotenv()

ABA_REGISTROS = "Registros"
CABECALHO = ["id", "alunoId", "alunoNome", "serie", "prova", "motivo", "pago", "observacoes", "criadoEm", "atualizadoEm"]

ESCOPOS = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]


def conectar_planilha():
    credenciais_path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    planilha_id = os.environ["PLANILHA_ID"]

    credenciais = Credentials.from_service_account_file(credenciais_path, scopes=ESCOPOS)
    cliente = gspread.authorize(credenciais)
    return cliente.open_by_key(planilha_id)


def obter_aba_registros(planilha):
    try:
        return planilha.worksheet(ABA_REGISTROS)
    except gspread.WorksheetNotFound:
        aba = planilha.add_worksheet(title=ABA_REGISTROS, rows=1, cols=len(CABECALHO))
        aba.append_row(CABECALHO)
        return aba


def listar_registros():
    """Retorna os registros como lista de dicts (chaves = CABECALHO)."""
    planilha = conectar_planilha()
    aba = obter_aba_registros(planilha)
    return aba.get_all_records()
