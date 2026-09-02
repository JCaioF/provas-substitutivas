"""Gera relatório resumo (contagem por série/status) com gráfico.

Uso:
    python relatorio.py [caminho_saida.png]
"""

import sys
from collections import Counter

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sheets_client import listar_registros


def gerar_relatorio(caminho_saida="relatorio_provas.png"):
    registros = listar_registros()

    total = len(registros)
    pagos = sum(1 for r in registros if r["pago"] == "SIM")
    pendentes = total - pagos

    print(f"Total de registros: {total}")
    print(f"Pagos: {pagos}")
    print(f"Pendentes: {pendentes}")
    print()

    por_serie = Counter(r["serie"] for r in registros)
    print("Por série:")
    for serie, quantidade in sorted(por_serie.items()):
        pagos_serie = sum(1 for r in registros if r["serie"] == serie and r["pago"] == "SIM")
        print(f"  {serie}: {quantidade} registro(s), {pagos_serie} pago(s)")

    if not registros:
        print("Nenhum registro para gerar gráfico.")
        return

    series = sorted(por_serie.keys())
    pagos_por_serie = [sum(1 for r in registros if r["serie"] == s and r["pago"] == "SIM") for s in series]
    pendentes_por_serie = [por_serie[s] - pagos_por_serie[i] for i, s in enumerate(series)]

    posicoes = range(len(series))
    largura = 0.35

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar([i - largura / 2 for i in posicoes], pagos_por_serie, largura, label="Pago", color="#10b981")
    ax.bar([i + largura / 2 for i in posicoes], pendentes_por_serie, largura, label="Pendente", color="#f39200")
    ax.set_xticks(list(posicoes))
    ax.set_xticklabels(series, rotation=30, ha="right")
    ax.set_ylabel("Registros")
    ax.set_title("Provas substitutivas por série")
    ax.legend()
    fig.tight_layout()
    fig.savefig(caminho_saida, dpi=150)
    print(f"\nGráfico salvo em {caminho_saida}")


if __name__ == "__main__":
    caminho = sys.argv[1] if len(sys.argv) > 1 else "relatorio_provas.png"
    gerar_relatorio(caminho)
