# CodeFix EDU

**Analise. Entenda. Corrija.**

O CodeFix EDU é um validador pedagógico para os projetos de loja virtual desenvolvidos em aula. O aluno pode enviar a pasta completa do projeto ou um arquivo `.zip`, receber um diagnóstico e consultar uma orientação de correção para cada problema encontrado.

## Referência do professor

O sistema usa como referência a branch `main` do repositório:

`Prof-Davi-Git/projeto-site-vendas`

A referência não é usada para exigir código idêntico. O CodeFix tenta reconhecer os recursos presentes no projeto-base e verificar se o projeto do aluno possui implementações equivalentes, mesmo quando nomes de arquivos, pastas, classes, produtos, cores e organização foram adaptados.

## O que a primeira versão analisa

- presença de HTML, CSS, JavaScript e imagens;
- caminhos de CSS e JavaScript usados pelo HTML;
- caminhos de imagens;
- links locais entre páginas;
- diferenças de letras maiúsculas/minúsculas em nomes de arquivos;
- funções JavaScript chamadas por eventos no HTML;
- IDs procurados pelo JavaScript;
- IDs duplicados no HTML;
- erros básicos de sintaxe JavaScript;
- quantidade incompatível de chaves no CSS;
- recursos identificados no projeto-base, como catálogo, pesquisa, categorias, detalhes do produto, variações, promoções, carrossel e contato;
- orientação de correção para cada problema identificado.

## Privacidade

Os arquivos escolhidos pelo aluno são processados no próprio navegador. Esta versão não envia o projeto do aluno para um servidor.

## Formas de envio

1. **Selecionar pasta**: funciona diretamente no navegador e não depende de biblioteca externa.
2. **Enviar .ZIP**: usa a biblioteca JSZip carregada por CDN.

O limite configurado para o `.zip` é de 30 MB e arquivos de texto individuais acima de 2 MB não são lidos pelo analisador.

## Limite importante desta versão

O CodeFix realiza **análise estática** do projeto. Isso significa que ele consegue identificar muitos problemas de estrutura e código sem executar o site do aluno em um navegador isolado. Uma futura versão poderá adicionar testes de execução automatizados para clicar em botões, navegar pelas páginas e verificar erros reais do console.

## Arquivos

- `index.html` — interface do sistema;
- `style.css` — identidade visual e responsividade;
- `script.js` — sincronização da referência, leitura dos projetos, análise e relatório.

## Publicação

O projeto foi criado para funcionar como site estático e pode ser publicado pelo GitHub Pages a partir da branch `main` e da pasta raiz `/`.
