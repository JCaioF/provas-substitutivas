# Dashboard de Provas Substitutivas

Controle de provas substitutivas (aluno, série, prova perdida, motivo, pagamento, observações).

Arquitetura no mesmo padrão do projeto `gas-deploy` (Colégio Elvira Brandão):

- **Apps Script** (`apps_script/`), standalone (não preso a nenhuma planilha) — dashboard ao vivo.
  - Aluno e série vêm do **Azure SQL** (mesma base do gas-deploy, tabela `GOLD_REG_DASHBOARD_MAT`), só leitura — evita nome/série digitado errado.
  - Registro de prova substitutiva (aluno, prova, motivo, pago, observações) é gravado numa planilha que **nasce sozinha** na primeira gravação — nenhum passo manual de criar planilha.
  - Sem Azure configurado, roda em **modo demonstração** (dado fictício de `MockData.gs`) — dá pra testar a interface inteira antes de plugar o banco.
  - Permissão **leitor/editor**: só quem está na lista `EDITORES` cadastra, edita, marca pago ou exclui; os demais só veem.
- **Python** (`python/`): tudo que não precisa rodar no navegador — relatório com gráfico, importação em massa via CSV, backup em CSV/XLSX. Roda local, lendo a mesma planilha de registros.

## 1. Publicar o Apps Script

1. Instale o [clasp](https://github.com/google/clasp) e faça login uma vez:

   ```bash
   npm install
   npx clasp login
   ```

2. Crie o projeto Apps Script (standalone — **não** vinculado a nenhuma planilha):

   ```bash
   npx clasp create --title "Provas Substitutivas" --rootDir apps_script
   ```

   (sem `--type`: o padrão é projeto solto, standalone — "webapp" não é tipo de criação, é modo de implantação, configurado no passo 4)

   Isso gera um `.clasp.json` na raiz apontando pro `scriptId` novo (sobrescreve o template que já está aqui).

3. Envie os arquivos:

   ```bash
   npm run clasp:push
   ```

4. `npm run clasp:open` abre o projeto no editor do Apps Script. Lá: **Implantar → Nova implantação → Aplicativo da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: quem for usar o dashboard (ex: qualquer pessoa da organização)

   Copie o link do Web App — é o link do dashboard. Ele já abre funcionando em **modo demonstração** (sem Azure configurado ainda).

## 2. Conectar o Azure SQL

No editor do Apps Script (`npm run clasp:open`), aba `Config.gs`:

1. Descomente e preencha `setupCredentials()`, depois **execute uma vez** (▶ no editor). Apague os valores do código em seguida.

   | Propriedade | Obrigatória | Para quê |
   |---|---|---|
   | `AZURE_SQL_URL` | sim | `jdbc:sqlserver://host:1433;databaseName=DB` |
   | `AZURE_SQL_USER` | sim | usuário do banco |
   | `AZURE_SQL_PASSWORD` | sim | senha |
   | `ALUNO_ID_FIELD` | não | padrão `ra` |
   | `FILIAL_FIELD` | não | padrão `filial_escola` |
   | `FILIAL_FIXA` | não | trava numa unidade só (`CHACARA` ou `MORUMBI`) |

2. Execute `testarConexao()` — o log diz exatamente onde parou, se parar.

   > ⚠️ **O erro mais comum não é senha errada — é firewall.** O Apps Script conecta pelos IPs do Google (dinâmicos); "Permitir serviços do Azure" não libera isso. Se travar em timeout, é o firewall do Azure SQL.

3. Assim que `AZURE_SQL_URL` existir, o modo demonstração desliga sozinho.

## 3. Liberar quem edita

No editor, aba `Config.gs`: preencha a lista `EDITORES` dentro de `setupEditores()` e execute uma vez. Quem não estiver na lista abre o sistema como leitor (só vê, não cadastra).

## 4. Configurar o lado Python

1. No editor do Apps Script, execute `criarPlanilhaDados()` (ou `verPlanilha()` se já existir) — o log mostra a URL e o **ID** da planilha de registros.
2. Crie uma [conta de serviço no Google Cloud](https://console.cloud.google.com/iam-admin/serviceaccounts), com acesso à Sheets API, e baixe o JSON de credenciais.
3. Compartilhe essa planilha (botão **Compartilhar**) com o e-mail da conta de serviço (`nome@projeto.iam.gserviceaccount.com`), permissão de Editor.
4. Instale as dependências:

   ```bash
   cd python
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. Copie `.env.example` para `.env` e preencha:

   ```
   GOOGLE_APPLICATION_CREDENTIALS=./credenciais.json
   PLANILHA_ID=<id do passo 1>
   ```

## 5. Usar os scripts Python

```bash
# Relatório resumo (console) + gráfico por série (PNG)
python relatorio.py

# Importar registros em lote de um CSV
# CSV precisa ter colunas: aluno,serie,prova,motivo,pago,observacoes (alunoId opcional)
python importar_csv.py caminho/alunos.csv

# Backup completo da planilha em CSV + XLSX
python exportar_backup.py
```
