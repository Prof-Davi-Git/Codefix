const REFERENCE = {
    owner: "Prof-Davi-Git",
    repo: "projeto-site-vendas",
    branch: "main",
    apiTree: "https://api.github.com/repos/Prof-Davi-Git/projeto-site-vendas/git/trees/main?recursive=1",
    rawBase: "https://raw.githubusercontent.com/Prof-Davi-Git/projeto-site-vendas/main/"
};

const TEXT_EXTENSIONS = new Set(["html", "htm", "css", "js", "mjs", "json", "txt", "md"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "ico"]);
const IGNORED_PARTS = new Set([".git", "node_modules", "dist", "build", ".idea", ".vscode"]);
const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024;
const MAX_ZIP_SIZE = 30 * 1024 * 1024;

const FEATURE_DEFINITIONS = [
    {
        key: "structure",
        label: "Estrutura HTML + CSS + JavaScript",
        severity: "error",
        solution: "Mantenha pelo menos uma página HTML e os arquivos de estilo e comportamento usados pelo projeto. Eles podem ter nomes diferentes dos arquivos do professor."
    },
    {
        key: "navigation",
        label: "Navegação entre páginas",
        severity: "error",
        solution: "Crie links entre as páginas do site e confira se cada href aponta para um arquivo que realmente existe dentro do projeto."
    },
    {
        key: "products",
        label: "Catálogo de produtos",
        severity: "error",
        solution: "Inclua a área de produtos com informações suficientes para identificá-los, como nome, imagem e preço. A aparência e os produtos podem ser totalmente diferentes do exemplo."
    },
    {
        key: "search",
        label: "Pesquisa de produtos",
        severity: "error",
        solution: "Crie um campo de pesquisa e uma rotina JavaScript que leia o texto digitado e filtre ou localize os produtos exibidos."
    },
    {
        key: "categories",
        label: "Filtro ou menu de categorias",
        severity: "error",
        solution: "Associe os produtos a categorias e use JavaScript para exibir apenas os itens da categoria escolhida. Os nomes das categorias podem ser adaptados à sua loja."
    },
    {
        key: "productDetail",
        label: "Página ou área de detalhes do produto",
        severity: "error",
        solution: "Ao selecionar um produto, leve o identificador ou os dados dele para uma página/área de detalhes e carregue as informações correspondentes."
    },
    {
        key: "variations",
        label: "Variações, modelos ou tamanhos",
        severity: "warning",
        solution: "Quando o tipo de produto exigir, apresente opções como tamanho, modelo, cor ou variação e permita que o usuário selecione uma delas."
    },
    {
        key: "promotions",
        label: "Área de promoções",
        severity: "error",
        solution: "Inclua a área de promoções trabalhada no projeto-base, com produtos/ofertas próprios da sua loja. Não é necessário copiar o layout do professor."
    },
    {
        key: "carousel",
        label: "Carrossel de promoções",
        severity: "warning",
        solution: "Organize os produtos promocionais em um carrossel ou mecanismo equivalente de navegação entre ofertas, com os controles funcionando."
    },
    {
        key: "contact",
        label: "Página ou área de contato",
        severity: "error",
        solution: "Mantenha uma área de contato identificável, com os dados ou campos adequados ao projeto da sua loja."
    },
    {
        key: "lazy",
        label: "Carregamento otimizado de imagens",
        severity: "warning",
        solution: "Nas imagens de produtos que ficam fora da primeira tela, use loading=\"lazy\" quando fizer sentido para reduzir carregamentos desnecessários."
    }
];

const FALLBACK_REFERENCE_KEYS = [
    "structure", "navigation", "products", "search", "categories", "productDetail",
    "variations", "promotions", "carousel", "contact", "lazy"
];

const state = {
    reference: {
        ready: false,
        online: false,
        sha: null,
        files: new Map(),
        requirements: FEATURE_DEFINITIONS.filter(item => FALLBACK_REFERENCE_KEYS.includes(item.key))
    },
    selected: null,
    diagnostics: [],
    analysis: null
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindEvents();
    syncReference();
});

function cacheElements() {
    [
        "referenceBadge", "referenceCommit", "syncReferenceBtn", "studentName", "dropZone",
        "chooseZipBtn", "chooseFolderBtn", "zipInput", "folderInput", "selectedProject",
        "selectedProjectName", "selectedProjectCount", "analyzeBtn", "uploadMessage",
        "analysisProgress", "progressTitle", "progressText", "resultsSection", "resultProjectName",
        "resultReferenceInfo", "newAnalysisBtn", "scoreValue", "scoreBar", "scoreMessage",
        "successCount", "warningCount", "errorCount", "diagnosticFilter", "diagnosticsList",
        "fileSummary", "requirementsSummary"
    ].forEach(id => {
        els[id] = document.getElementById(id);
    });
}

function bindEvents() {
    els.chooseZipBtn.addEventListener("click", event => {
        event.stopPropagation();
        els.zipInput.click();
    });

    els.chooseFolderBtn.addEventListener("click", event => {
        event.stopPropagation();
        els.folderInput.click();
    });

    els.dropZone.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        els.zipInput.click();
    });

    els.dropZone.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            els.zipInput.click();
        }
    });

    ["dragenter", "dragover"].forEach(type => {
        els.dropZone.addEventListener(type, event => {
            event.preventDefault();
            els.dropZone.classList.add("dragging");
        });
    });

    ["dragleave", "drop"].forEach(type => {
        els.dropZone.addEventListener(type, event => {
            event.preventDefault();
            els.dropZone.classList.remove("dragging");
        });
    });

    els.dropZone.addEventListener("drop", async event => {
        const file = event.dataTransfer.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".zip")) {
            setUploadMessage("Ao arrastar, envie um arquivo .ZIP. Para uma pasta, use o botão ‘Selecionar pasta’.", true);
            return;
        }
        await loadZip(file);
    });

    els.zipInput.addEventListener("change", async () => {
        const file = els.zipInput.files?.[0];
        if (file) await loadZip(file);
    });

    els.folderInput.addEventListener("change", async () => {
        if (els.folderInput.files?.length) {
            await loadFolder(els.folderInput.files);
        }
    });

    els.analyzeBtn.addEventListener("click", runAnalysis);
    els.syncReferenceBtn.addEventListener("click", () => syncReference(true));
    els.diagnosticFilter.addEventListener("change", renderDiagnostics);
    els.newAnalysisBtn.addEventListener("click", resetForNewAnalysis);
}

async function syncReference(userRequested = false) {
    setReferenceStatus("loading", "Sincronizando...", "Buscando a versão atual da branch main");
    els.syncReferenceBtn.disabled = true;

    try {
        const response = await fetch(REFERENCE.apiTree, { cache: "no-store" });
        if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`);

        const data = await response.json();
        const codeEntries = (data.tree || []).filter(entry => {
            if (entry.type !== "blob") return false;
            const ext = getExtension(entry.path);
            return ["html", "htm", "css", "js", "mjs"].includes(ext);
        });

        const referenceFiles = new Map();
        const settled = await Promise.allSettled(codeEntries.map(async entry => {
            const url = REFERENCE.rawBase + encodePathForUrl(entry.path);
            const fileResponse = await fetch(url, { cache: "no-store" });
            if (!fileResponse.ok) throw new Error(`Falha ao ler ${entry.path}`);
            const content = await fileResponse.text();
            return [normalizePath(entry.path), { path: normalizePath(entry.path), content, size: content.length }];
        }));

        settled.forEach(result => {
            if (result.status === "fulfilled") {
                referenceFiles.set(result.value[0], result.value[1]);
            }
        });

        if (!referenceFiles.size) throw new Error("Nenhum arquivo de código da referência pôde ser lido.");

        const features = detectFeatures(referenceFiles);
        const requirements = FEATURE_DEFINITIONS.filter(item => features[item.key]);

        state.reference = {
            ready: true,
            online: true,
            sha: data.sha || null,
            files: referenceFiles,
            requirements: requirements.length ? requirements : FEATURE_DEFINITIONS.filter(item => FALLBACK_REFERENCE_KEYS.includes(item.key))
        };

        const shortSha = state.reference.sha ? state.reference.sha.slice(0, 7) : "atual";
        setReferenceStatus(
            "ready",
            "Referência atualizada",
            `Versão ${shortSha} • ${referenceFiles.size} arquivos de código lidos`
        );

        try {
            localStorage.setItem("codefix-reference-cache", JSON.stringify({
                sha: state.reference.sha,
                requirementKeys: state.reference.requirements.map(item => item.key),
                savedAt: Date.now()
            }));
        } catch (_) {
            // O cache é apenas uma conveniência; a análise continua sem ele.
        }

        if (userRequested) setUploadMessage("Projeto-base atualizado com sucesso.", false);
    } catch (error) {
        applyCachedOrFallbackReference(error);
    } finally {
        els.syncReferenceBtn.disabled = false;
    }
}

function applyCachedOrFallbackReference(error) {
    let cache = null;
    try {
        cache = JSON.parse(localStorage.getItem("codefix-reference-cache") || "null");
    } catch (_) {
        cache = null;
    }

    if (cache?.requirementKeys?.length) {
        state.reference = {
            ready: true,
            online: false,
            sha: cache.sha || null,
            files: new Map(),
            requirements: FEATURE_DEFINITIONS.filter(item => cache.requirementKeys.includes(item.key))
        };
        const shortSha = cache.sha ? cache.sha.slice(0, 7) : "salva";
        setReferenceStatus("offline", "Usando referência salva", `Versão ${shortSha} • sincronização online indisponível`);
    } else {
        state.reference = {
            ready: true,
            online: false,
            sha: null,
            files: new Map(),
            requirements: FEATURE_DEFINITIONS.filter(item => FALLBACK_REFERENCE_KEYS.includes(item.key))
        };
        setReferenceStatus("offline", "Referência local", "GitHub indisponível • usando requisitos conhecidos do projeto-base");
    }

    console.warn("CodeFix: não foi possível sincronizar a referência.", error);
}

function setReferenceStatus(className, label, detail) {
    els.referenceBadge.className = `badge ${className}`;
    els.referenceBadge.textContent = label;
    els.referenceCommit.textContent = detail;
}

async function loadFolder(fileList) {
    setUploadMessage("Lendo a pasta do projeto...", false);
    try {
        const raw = new Map();
        const files = Array.from(fileList);

        await Promise.all(files.map(async file => {
            const originalPath = file.webkitRelativePath || file.name;
            const path = normalizePath(originalPath);
            if (shouldIgnorePath(path)) return;
            raw.set(path, await browserFileToRecord(file, path));
        }));

        const projectName = detectTopFolder(files.map(file => file.webkitRelativePath || file.name)) || "Pasta do projeto";
        setSelectedProject(projectName, stripCommonRoot(raw), "folder");
    } catch (error) {
        console.error(error);
        setUploadMessage("Não consegui ler a pasta selecionada. Tente novamente ou envie um .ZIP.", true);
    }
}

async function loadZip(file) {
    setUploadMessage("Abrindo o arquivo .ZIP...", false);

    if (file.size > MAX_ZIP_SIZE) {
        setUploadMessage("O .ZIP ultrapassa 30 MB. Remova arquivos desnecessários e tente novamente.", true);
        return;
    }

    if (!window.JSZip) {
        setUploadMessage("O leitor de .ZIP não carregou. Use ‘Selecionar pasta’ ou recarregue a página com internet.", true);
        return;
    }

    try {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(entry => !entry.dir && !shouldIgnorePath(entry.name));
        const raw = new Map();

        await Promise.all(entries.map(async entry => {
            const path = normalizePath(entry.name);
            const ext = getExtension(path);
            let content = null;

            if (TEXT_EXTENSIONS.has(ext)) {
                content = await entry.async("string");
                if (content.length > MAX_TEXT_FILE_SIZE) content = null;
            }

            raw.set(path, { path, content, size: content ? content.length : 0 });
        }));

        const name = file.name.replace(/\.zip$/i, "") || "Projeto compactado";
        setSelectedProject(name, stripCommonRoot(raw), "zip");
    } catch (error) {
        console.error(error);
        setUploadMessage("Não consegui abrir esse .ZIP. Verifique se ele não está corrompido e tente novamente.", true);
    }
}

async function browserFileToRecord(file, path) {
    const ext = getExtension(path);
    let content = null;

    if (TEXT_EXTENSIONS.has(ext) && file.size <= MAX_TEXT_FILE_SIZE) {
        content = await file.text();
    }

    return { path, content, size: file.size };
}

function setSelectedProject(name, files, source) {
    if (!files.size) {
        setUploadMessage("A seleção não contém arquivos úteis para analisar.", true);
        return;
    }

    state.selected = { name, files, source };
    els.selectedProjectName.textContent = name;
    els.selectedProjectCount.textContent = `${files.size} arquivo${files.size === 1 ? "" : "s"}`;
    els.selectedProject.classList.remove("hidden");
    els.analyzeBtn.disabled = false;
    els.resultsSection.classList.add("hidden");
    setUploadMessage("Projeto pronto para análise.", false);
}

function setUploadMessage(message, isError) {
    els.uploadMessage.textContent = message;
    els.uploadMessage.classList.toggle("error", Boolean(isError));
}

async function runAnalysis() {
    if (!state.selected) return;

    els.analyzeBtn.disabled = true;
    els.resultsSection.classList.add("hidden");
    els.analysisProgress.classList.remove("hidden");
    els.progressTitle.textContent = "Lendo os arquivos do projeto...";
    els.progressText.textContent = "Separando HTML, CSS, JavaScript e recursos do site.";
    els.analysisProgress.scrollIntoView({ behavior: "smooth", block: "center" });

    await nextPaint();

    try {
        els.progressTitle.textContent = "Procurando problemas técnicos...";
        els.progressText.textContent = "Conferindo caminhos, links, funções, IDs e sintaxe básica.";
        await nextPaint();

        const result = analyzeProject(state.selected.files, state.reference.requirements);
        state.analysis = result;
        state.diagnostics = result.diagnostics;

        els.progressTitle.textContent = "Comparando com o projeto-base...";
        els.progressText.textContent = "Verificando as funcionalidades já trabalhadas em aula sem exigir código idêntico.";
        await new Promise(resolve => setTimeout(resolve, 120));

        renderResults(result);
        els.analysisProgress.classList.add("hidden");
        els.resultsSection.classList.remove("hidden");
        els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error(error);
        els.analysisProgress.classList.add("hidden");
        els.analyzeBtn.disabled = false;
        setUploadMessage("Ocorreu um problema durante a análise. Tente selecionar o projeto novamente.", true);
    }
}

function analyzeProject(files, referenceRequirements) {
    const diagnostics = [];
    const inventory = buildInventory(files);
    const allPaths = Array.from(files.keys());
    const lowerPathMap = new Map(allPaths.map(path => [path.toLowerCase(), path]));
    const htmlIdSet = new Set();
    const htmlDocuments = [];
    const inlineJsParts = [];
    const technical = {
        brokenReferences: 0,
        caseWarnings: 0,
        unresolvedFunctions: 0,
        unresolvedIds: 0,
        jsSyntaxErrors: 0,
        duplicateIds: 0,
        cssBraceProblems: 0
    };

    if (!inventory.html.length) {
        pushDiagnostic(diagnostics, "error", "Nenhuma página HTML encontrada", "Estrutura do projeto", "O CodeFix não encontrou arquivos .html ou .htm.", "Inclua pelo menos a página HTML principal do seu site dentro da pasta enviada.");
    } else {
        pushDiagnostic(diagnostics, "success", "Páginas HTML encontradas", "Estrutura do projeto", `${inventory.html.length} página(s) HTML disponível(is) para análise.`, "Nenhuma correção é necessária neste item.");
    }

    inventory.html.forEach(path => {
        const record = files.get(path);
        if (!record?.content) {
            pushDiagnostic(diagnostics, "warning", "Arquivo HTML não pôde ser lido", path, "O arquivo existe, mas é grande demais ou não pôde ser interpretado como texto.", "Abra o arquivo e verifique se ele contém somente o código HTML necessário.");
            return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(record.content, "text/html");
        htmlDocuments.push({ path, doc, content: record.content });

        if (!/<!doctype\s+html/i.test(record.content)) {
            pushDiagnostic(diagnostics, "warning", "DOCTYPE não identificado", path, "A declaração <!DOCTYPE html> não foi localizada no início da página.", "Adicione <!DOCTYPE html> antes da tag <html> para o navegador usar o modo padrão do HTML5.");
        }

        const idsInFile = new Set();
        doc.querySelectorAll("[id]").forEach(element => {
            const id = element.id?.trim();
            if (!id) return;
            htmlIdSet.add(id);
            if (idsInFile.has(id)) {
                technical.duplicateIds += 1;
                pushDiagnostic(diagnostics, "warning", `ID duplicado: #${id}`, path, "O mesmo ID aparece mais de uma vez nesta página. IDs devem identificar um único elemento.", `Mantenha o ID “${id}” em apenas um elemento ou troque os demais por classes/IDs diferentes.`);
            }
            idsInFile.add(id);
        });

        doc.querySelectorAll("script:not([src])").forEach(script => {
            if (script.textContent?.trim()) inlineJsParts.push(script.textContent);
        });

        analyzeHtmlReferences(path, doc, files, lowerPathMap, allPaths, diagnostics, technical);
    });

    const jsCombined = [
        ...inventory.js.map(path => files.get(path)?.content || ""),
        ...inlineJsParts
    ].join("\n\n");

    analyzeJavascript(inventory.js, files, jsCombined, htmlIdSet, diagnostics, technical);
    analyzeInlineHandlers(htmlDocuments, jsCombined, diagnostics, technical);
    analyzeCss(inventory.css, files, diagnostics, technical);

    addAggregateTechnicalDiagnostics(diagnostics, inventory, technical);

    const studentFeatures = detectFeatures(files);
    const requirements = (referenceRequirements?.length ? referenceRequirements : FEATURE_DEFINITIONS.filter(item => FALLBACK_REFERENCE_KEYS.includes(item.key))).map(requirement => {
        const met = Boolean(studentFeatures[requirement.key]);
        if (met) {
            pushDiagnostic(
                diagnostics,
                "success",
                requirement.label,
                "Comparação com o projeto-base",
                "O CodeFix identificou este recurso no projeto. A implementação pode ser diferente da utilizada pelo professor.",
                "Nenhuma correção é necessária neste item."
            );
        } else {
            pushDiagnostic(
                diagnostics,
                requirement.severity,
                `${requirement.label} não identificado`,
                "Comparação com o projeto-base",
                "Esse recurso aparece na versão atual de referência, mas não foi possível identificá-lo de forma confiável no projeto enviado.",
                requirement.solution
            );
        }
        return { ...requirement, met };
    });

    const counts = diagnostics.reduce((acc, item) => {
        acc[item.type] += 1;
        return acc;
    }, { success: 0, warning: 0, error: 0 });

    const score = calculateScore(counts, requirements.length);

    return {
        diagnostics,
        counts,
        score,
        inventory,
        requirements,
        features: studentFeatures,
        technical
    };
}

function buildInventory(files) {
    const result = { total: files.size, html: [], css: [], js: [], images: [], other: [] };
    for (const path of files.keys()) {
        const ext = getExtension(path);
        if (["html", "htm"].includes(ext)) result.html.push(path);
        else if (ext === "css") result.css.push(path);
        else if (["js", "mjs"].includes(ext)) result.js.push(path);
        else if (IMAGE_EXTENSIONS.has(ext)) result.images.push(path);
        else result.other.push(path);
    }
    return result;
}

function analyzeHtmlReferences(htmlPath, doc, files, lowerPathMap, allPaths, diagnostics, technical) {
    const references = [];

    doc.querySelectorAll("script[src]").forEach(element => references.push({ value: element.getAttribute("src"), kind: "JavaScript", critical: true }));
    doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(element => references.push({ value: element.getAttribute("href"), kind: "CSS", critical: true }));
    doc.querySelectorAll("img[src], source[src], video[poster]").forEach(element => references.push({ value: element.getAttribute("src") || element.getAttribute("poster"), kind: "imagem", critical: true }));
    doc.querySelectorAll("a[href]").forEach(element => references.push({ value: element.getAttribute("href"), kind: "link", critical: false }));

    references.forEach(reference => {
        const raw = (reference.value || "").trim();
        if (isExternalOrSpecialReference(raw)) return;

        const resolved = resolveRelativePath(htmlPath, raw);
        if (!resolved) return;

        if (files.has(resolved)) return;

        const caseMatch = lowerPathMap.get(resolved.toLowerCase());
        if (caseMatch) {
            technical.caseWarnings += 1;
            pushDiagnostic(
                diagnostics,
                "warning",
                `Diferença de maiúsculas/minúsculas em caminho de ${reference.kind}`,
                htmlPath,
                `O código aponta para “${raw}”, mas o arquivo encontrado é “${caseMatch}”. Isso pode funcionar no Windows e falhar ao publicar o site.`,
                `Ajuste o caminho para usar exatamente o mesmo nome do arquivo: “${relativeSuggestion(htmlPath, caseMatch)}”.`
            );
            return;
        }

        technical.brokenReferences += 1;
        const closest = findClosestPath(resolved, allPaths);
        const type = reference.critical ? "error" : "warning";
        const suggestion = closest
            ? `O arquivo mais parecido encontrado é “${closest}”. Confira se o caminho correto deveria ser “${relativeSuggestion(htmlPath, closest)}”.`
            : "Confira o nome do arquivo, a pasta onde ele está salvo e a quantidade de ../ usada para voltar pastas.";

        pushDiagnostic(
            diagnostics,
            type,
            `${capitalize(reference.kind)} não encontrado(a)`,
            htmlPath,
            `A referência “${raw}” resolve para “${resolved}”, mas esse arquivo não existe na pasta enviada.`,
            suggestion
        );
    });
}

function analyzeJavascript(jsPaths, files, jsCombined, htmlIdSet, diagnostics, technical) {
    jsPaths.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) {
            pushDiagnostic(diagnostics, "warning", "JavaScript não pôde ser lido", path, "O arquivo existe, mas não foi possível analisar o conteúdo.", "Verifique se o arquivo contém texto JavaScript e não ultrapassa o tamanho necessário para o projeto.");
            return;
        }

        if (!/^\s*(?:import|export)\b/m.test(content)) {
            try {
                // Analisa a sintaxe sem executar o arquivo.
                new Function(content);
            } catch (error) {
                technical.jsSyntaxErrors += 1;
                pushDiagnostic(
                    diagnostics,
                    "error",
                    "Possível erro de sintaxe JavaScript",
                    path,
                    cleanErrorMessage(error?.message || "O navegador não conseguiu interpretar o arquivo."),
                    "Abra esse arquivo no VS Code e revise principalmente chaves, parênteses, aspas, vírgulas e blocos que foram adicionados recentemente."
                );
            }
        }

        const idPatterns = [
            /getElementById\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
            /querySelector\s*\(\s*["'`]#([^"'`\s.:[\]>+~]+)["'`]\s*\)/g
        ];

        idPatterns.forEach(regex => {
            for (const match of content.matchAll(regex)) {
                const id = match[1];
                if (!id || htmlIdSet.has(id)) continue;
                technical.unresolvedIds += 1;
                pushDiagnostic(
                    diagnostics,
                    "warning",
                    `ID #${id} usado no JavaScript não foi encontrado`,
                    path,
                    `O JavaScript procura um elemento com id="${id}", mas nenhum HTML enviado possui esse ID.`,
                    `Confira se o elemento teve o ID renomeado. Se o JavaScript estiver correto, adicione id="${id}" ao elemento correspondente; se o HTML estiver correto, atualize o seletor no JavaScript.`
                );
            }
        });
    });

    if (!jsPaths.length && jsCombined.trim()) {
        pushDiagnostic(diagnostics, "success", "JavaScript incorporado ao HTML identificado", "Estrutura do projeto", "Há código JavaScript dentro das páginas HTML.", "Nenhuma correção é necessária neste item.");
    }
}

function analyzeInlineHandlers(htmlDocuments, jsCombined, diagnostics, technical) {
    const ignored = new Set(["alert", "confirm", "prompt", "open", "close", "print", "setTimeout", "setInterval"]);
    const checked = new Set();

    htmlDocuments.forEach(({ path, doc }) => {
        doc.querySelectorAll("*").forEach(element => {
            Array.from(element.attributes || []).forEach(attribute => {
                if (!attribute.name.toLowerCase().startsWith("on")) return;
                const handler = attribute.value || "";
                const calls = Array.from(handler.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)).map(match => match[1]);

                calls.forEach(name => {
                    if (ignored.has(name) || checked.has(`${path}:${name}`)) return;
                    checked.add(`${path}:${name}`);
                    if (hasFunctionDefinition(jsCombined, name)) return;

                    technical.unresolvedFunctions += 1;
                    pushDiagnostic(
                        diagnostics,
                        "error",
                        `Função ${name}() não foi encontrada`,
                        path,
                        `O HTML chama ${name}(), mas o CodeFix não localizou a definição dessa função nos arquivos JavaScript enviados.`,
                        `Procure por “function ${name}” no seu projeto. Se a função foi renomeada, atualize o evento no HTML; se ela foi apagada, restaure a lógica correspondente no JavaScript.`
                    );
                });
            });
        });
    });
}

function analyzeCss(cssPaths, files, diagnostics, technical) {
    cssPaths.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) return;
        const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
        const openings = (stripped.match(/\{/g) || []).length;
        const closings = (stripped.match(/\}/g) || []).length;
        if (openings !== closings) {
            technical.cssBraceProblems += 1;
            pushDiagnostic(
                diagnostics,
                "warning",
                "Quantidade de chaves CSS não confere",
                path,
                `Foram encontradas ${openings} chave(s) de abertura e ${closings} de fechamento.`,
                "Revise os blocos CSS adicionados recentemente e confira se cada { possui uma chave } correspondente."
            );
        }
    });
}

function addAggregateTechnicalDiagnostics(diagnostics, inventory, technical) {
    if (inventory.css.length) {
        pushDiagnostic(diagnostics, "success", "Arquivos CSS encontrados", "Estrutura do projeto", `${inventory.css.length} arquivo(s) de estilo identificado(s).`, "Nenhuma correção é necessária neste item.");
    }
    if (inventory.js.length) {
        pushDiagnostic(diagnostics, "success", "Arquivos JavaScript encontrados", "Estrutura do projeto", `${inventory.js.length} arquivo(s) JavaScript identificado(s).`, "Nenhuma correção é necessária neste item.");
    }
    if (inventory.images.length) {
        pushDiagnostic(diagnostics, "success", "Imagens do projeto encontradas", "Estrutura do projeto", `${inventory.images.length} arquivo(s) de imagem identificado(s).`, "Nenhuma correção é necessária neste item.");
    }

    if (technical.brokenReferences === 0) {
        pushDiagnostic(diagnostics, "success", "Nenhum caminho quebrado identificado", "Referências entre arquivos", "CSS, scripts, imagens e links locais analisados não apresentaram caminhos inexistentes.", "Nenhuma correção é necessária neste item.");
    }
    if (technical.jsSyntaxErrors === 0 && inventory.js.length) {
        pushDiagnostic(diagnostics, "success", "Sintaxe básica do JavaScript aprovada", "JavaScript", "Nenhum erro básico de sintaxe foi identificado nos arquivos JavaScript analisados.", "Nenhuma correção é necessária neste item.");
    }
    if (technical.unresolvedFunctions === 0) {
        pushDiagnostic(diagnostics, "success", "Funções chamadas pelo HTML localizadas", "HTML + JavaScript", "As funções identificadas em eventos inline possuem definição correspondente no código analisado.", "Nenhuma correção é necessária neste item.");
    }
}

function detectFeatures(files) {
    const inventory = buildInventory(files);
    const htmlText = inventory.html.map(path => files.get(path)?.content || "").join("\n").toLowerCase();
    const jsText = inventory.js.map(path => files.get(path)?.content || "").join("\n").toLowerCase();
    const allText = `${htmlText}\n${jsText}`;

    let localHtmlLinks = 0;
    let searchInputs = 0;
    let productSignals = 0;

    inventory.html.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) return;
        const doc = new DOMParser().parseFromString(content, "text/html");
        doc.querySelectorAll("a[href]").forEach(anchor => {
            const href = (anchor.getAttribute("href") || "").toLowerCase();
            if (href.includes(".html") && !isExternalOrSpecialReference(href)) localHtmlLinks += 1;
        });
        doc.querySelectorAll('input[type="search"], input[type="text"]').forEach(input => {
            const signal = `${input.id} ${input.className} ${input.getAttribute("placeholder") || ""}`.toLowerCase();
            if (/pesquis|busc|procur|search/.test(signal)) searchInputs += 1;
        });
        doc.querySelectorAll("article, .produto, [class*='produto'], [class*='product'], [data-categoria], [data-category]").forEach(() => {
            productSignals += 1;
        });
    });

    const hasPriceSignal = /r\$\s*\d|pre[cç]o|price/.test(allText);
    const hasProductWord = /produto|product/.test(allText);
    const hasSearchLogic = /includes\s*\(|filter\s*\(|toLowerCase\s*\(|filtrar|pesquis|buscar/.test(jsText);
    const hasCategoryMarkup = /data-categoria|data-category|categoria|category/.test(allText);
    const hasCategoryLogic = /dataset\.(categoria|category)|filtrarcategoria|categoria\s*===|category\s*===/.test(jsText);
    const hasDetailTransport = /urlsearchparams|location\.search|\?id=|searchparams|parametros\.get|params\.get/.test(jsText);
    const hasDetailWords = /descri[cç][aã]o|modelo|varia[cç][aã]o|tamanho|detalhe/.test(allText);
    const hasPromo = /promo[cç][aã]|oferta|desconto/.test(allText);
    const hasCarousel = /carrossel|carousel|movercarrossel|slide/.test(allText);
    const hasContact = /contato|contact|type=["']email["']|mailto:|telefone|whatsapp/.test(allText);
    const hasVariations = /varia[cç][aã]|tamanho|modelo|cor selecion|op[cç][aã]o/.test(allText);

    return {
        structure: inventory.html.length > 0 && inventory.css.length > 0 && (inventory.js.length > 0 || /<script[\s>]/.test(htmlText)),
        navigation: inventory.html.length >= 2 && localHtmlLinks >= 2,
        products: hasProductWord && hasPriceSignal && (productSignals >= 2 || /produtos\s*=|const\s+produtos|let\s+produtos/.test(jsText)),
        search: searchInputs > 0 && hasSearchLogic,
        categories: hasCategoryMarkup && hasCategoryLogic,
        productDetail: hasDetailTransport && hasDetailWords,
        variations: hasVariations,
        promotions: hasPromo,
        carousel: hasCarousel,
        contact: hasContact,
        lazy: /loading\s*=\s*["']lazy["']/.test(htmlText)
    };
}

function calculateScore(counts, requirementCount) {
    const baseline = Math.max(10, requirementCount + 7);
    const penalty = counts.error * 8 + counts.warning * 3;
    return Math.max(0, Math.min(100, Math.round(100 - (penalty / baseline) * 10)));
}

function renderResults(result) {
    const studentLabel = els.studentName.value.trim();
    els.resultProjectName.textContent = studentLabel || state.selected.name;

    const refVersion = state.reference.sha ? state.reference.sha.slice(0, 7) : "referência local";
    els.resultReferenceInfo.textContent = state.reference.online
        ? `Comparado com os recursos identificados na versão ${refVersion} do projeto-base do professor.`
        : "Comparado com a última referência conhecida do projeto-base do professor.";

    els.scoreValue.textContent = `${result.score}%`;
    requestAnimationFrame(() => { els.scoreBar.style.width = `${result.score}%`; });
    els.scoreMessage.textContent = scoreMessage(result.score, result.counts.error);
    els.successCount.textContent = result.counts.success;
    els.warningCount.textContent = result.counts.warning;
    els.errorCount.textContent = result.counts.error;

    renderFileSummary(result.inventory);
    renderRequirementsSummary(result.requirements);
    els.diagnosticFilter.value = "all";
    renderDiagnostics();
    els.analyzeBtn.disabled = false;
}

function renderFileSummary(inventory) {
    const rows = [
        ["HTML", inventory.html.length],
        ["CSS", inventory.css.length],
        ["JavaScript", inventory.js.length],
        ["Imagens", inventory.images.length],
        ["Outros", inventory.other.length],
        ["Total", inventory.total]
    ];

    els.fileSummary.innerHTML = rows.map(([label, value]) => `
        <div class="summary-row"><span>${escapeHTML(label)}</span><strong>${value}</strong></div>
    `).join("");
}

function renderRequirementsSummary(requirements) {
    if (!requirements.length) {
        els.requirementsSummary.innerHTML = '<div class="empty-state">Nenhum requisito de referência disponível.</div>';
        return;
    }

    els.requirementsSummary.innerHTML = requirements.map(item => `
        <div class="requirement-row">
            <span>${escapeHTML(item.label)}</span>
            <strong class="${item.met ? "met" : item.severity === "warning" ? "optional" : "missing"}">${item.met ? "OK" : "REVISAR"}</strong>
        </div>
    `).join("");
}

function renderDiagnostics() {
    const filter = els.diagnosticFilter.value;
    const items = state.diagnostics.filter(item => filter === "all" || item.type === filter);

    if (!items.length) {
        els.diagnosticsList.innerHTML = '<div class="empty-state">Nenhum diagnóstico neste filtro.</div>';
        return;
    }

    const labels = { error: "Erro", warning: "Atenção", success: "Aprovado" };
    els.diagnosticsList.innerHTML = items.map((item, index) => `
        <article class="diagnostic-card ${item.type}${index === 0 && item.type !== "success" ? " open" : ""}">
            <button class="diagnostic-head" type="button" aria-expanded="${index === 0 && item.type !== "success" ? "true" : "false"}">
                <div>
                    <span class="status-label ${item.type}">${labels[item.type]}</span>
                    <h3>${escapeHTML(item.title)}</h3>
                    <p>${escapeHTML(shorten(item.detail, 145))}</p>
                </div>
                <span aria-hidden="true">+</span>
            </button>
            <div class="diagnostic-body">
                <span class="location">${escapeHTML(item.location)}</span>
                <p>${escapeHTML(item.detail)}</p>
                <div class="solution-box">
                    <strong>COMO CORRIGIR</strong>
                    <p>${escapeHTML(item.solution)}</p>
                </div>
            </div>
        </article>
    `).join("");

    els.diagnosticsList.querySelectorAll(".diagnostic-head").forEach(button => {
        button.addEventListener("click", () => {
            const card = button.closest(".diagnostic-card");
            const isOpen = card.classList.toggle("open");
            button.setAttribute("aria-expanded", String(isOpen));
        });
    });
}

function resetForNewAnalysis() {
    els.resultsSection.classList.add("hidden");
    document.getElementById("analisador").scrollIntoView({ behavior: "smooth", block: "start" });
    els.analyzeBtn.disabled = !state.selected;
}

function pushDiagnostic(list, type, title, location, detail, solution) {
    list.push({ type, title, location, detail, solution });
}

function hasFunctionDefinition(code, name) {
    if (!code) return false;
    const escaped = escapeRegex(name);
    const patterns = [
        new RegExp(`function\\s+${escaped}\\s*\\(`),
        new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:function\\b|(?:async\\s*)?\\([^)]*\\)\\s*=>|(?:async\\s*)?[A-Za-z_$][\\w$]*\\s*=>)`),
        new RegExp(`(?:window\\.)?${escaped}\\s*=\\s*function\\b`)
    ];
    return patterns.some(regex => regex.test(code));
}

function isExternalOrSpecialReference(value) {
    if (!value) return true;
    return /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|#)/i.test(value) || value.startsWith("//");
}

function resolveRelativePath(baseFile, rawReference) {
    if (!rawReference || isExternalOrSpecialReference(rawReference)) return null;
    const clean = safeDecode(rawReference.split("#")[0].split("?")[0].replace(/\\/g, "/").trim());
    if (!clean) return null;

    const baseParts = normalizePath(baseFile).split("/");
    baseParts.pop();
    const targetParts = clean.startsWith("/") ? [] : baseParts;

    clean.split("/").forEach(part => {
        if (!part || part === ".") return;
        if (part === "..") targetParts.pop();
        else targetParts.push(part);
    });

    return normalizePath(targetParts.join("/"));
}

function relativeSuggestion(fromFile, targetFile) {
    const from = normalizePath(fromFile).split("/");
    from.pop();
    const target = normalizePath(targetFile).split("/");
    let common = 0;
    while (common < from.length && common < target.length && from[common] === target[common]) common += 1;
    const up = from.slice(common).map(() => "..");
    return [...up, ...target.slice(common)].join("/") || targetFile;
}

function findClosestPath(target, paths) {
    const targetBase = basename(target).toLowerCase();
    const exactBase = paths.find(path => basename(path).toLowerCase() === targetBase);
    if (exactBase) return exactBase;

    const ext = getExtension(target);
    const candidates = paths.filter(path => getExtension(path) === ext);
    let best = null;
    let bestScore = Infinity;

    candidates.slice(0, 200).forEach(path => {
        const score = levenshtein(target.toLowerCase(), path.toLowerCase());
        if (score < bestScore) {
            bestScore = score;
            best = path;
        }
    });

    const threshold = Math.max(4, Math.floor(target.length * 0.35));
    return bestScore <= threshold ? best : null;
}

function stripCommonRoot(files) {
    const paths = Array.from(files.keys());
    if (!paths.length) return files;
    const firstSegments = paths.map(path => path.split("/")[0]).filter(Boolean);
    const first = firstSegments[0];
    if (!first || !firstSegments.every(segment => segment === first)) return files;
    if (paths.some(path => !path.includes("/"))) return files;

    const stripped = new Map();
    for (const [path, record] of files.entries()) {
        const nextPath = path.split("/").slice(1).join("/");
        stripped.set(nextPath, { ...record, path: nextPath });
    }
    return stripped;
}

function detectTopFolder(paths) {
    const normalized = paths.map(normalizePath).filter(Boolean);
    if (!normalized.length) return null;
    const first = normalized[0].split("/")[0];
    return normalized.every(path => path.split("/")[0] === first) ? first : null;
}

function shouldIgnorePath(path) {
    const normalized = normalizePath(path);
    const parts = normalized.split("/");
    return parts.some(part => IGNORED_PARTS.has(part) || part === ".DS_Store" || part === "Thumbs.db");
}

function normalizePath(path) {
    const parts = String(path || "").replace(/\\/g, "/").split("/");
    const out = [];
    parts.forEach(part => {
        if (!part || part === ".") return;
        if (part === "..") out.pop();
        else out.push(part);
    });
    return out.join("/");
}

function encodePathForUrl(path) {
    return normalizePath(path).split("/").map(part => encodeURIComponent(part)).join("/");
}

function getExtension(path) {
    const name = basename(path);
    if (!name.includes(".")) return "";
    return name.split(".").pop().toLowerCase();
}

function basename(path) {
    return normalizePath(path).split("/").pop() || "";
}

function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function cleanErrorMessage(message) {
    return String(message).replace(/^Uncaught\s+/i, "").slice(0, 220);
}

function scoreMessage(score, errors) {
    if (score >= 92 && errors === 0) return "Projeto muito consistente com os recursos analisados.";
    if (score >= 80) return "Projeto bem encaminhado. Revise os itens destacados.";
    if (score >= 60) return "Há pontos importantes para corrigir antes de considerar o projeto concluído.";
    return "O projeto precisa de revisão. Comece pelos erros em vermelho e analise novamente depois.";
}

function shorten(text, max) {
    const value = String(text || "");
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch (_) {
        return value;
    }
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function levenshtein(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,
                matrix[j][i - 1] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
}

function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
