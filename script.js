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
const MAX_ZIP_SIZE = 50 * 1024 * 1024;

const FEATURE_DEFINITIONS = [
    ["structure", "Estrutura HTML + CSS + JavaScript", "error", "Mantenha pelo menos uma página HTML e os arquivos de estilo e comportamento usados pelo projeto."],
    ["navigation", "Navegação entre páginas", "error", "Confira os links do menu e garanta que cada href aponta para um arquivo existente."],
    ["products", "Catálogo de produtos", "error", "Inclua uma área de produtos com nome, imagem e preço. Os produtos podem ser diferentes do projeto do professor."],
    ["search", "Pesquisa de produtos", "error", "Crie um campo de pesquisa e uma rotina JavaScript para localizar ou filtrar os produtos."],
    ["categories", "Filtro ou menu de categorias", "error", "Associe produtos a categorias e faça o JavaScript filtrar os itens escolhidos."],
    ["productDetail", "Página ou área de detalhes do produto", "error", "Ao selecionar um produto, abra uma página ou área com as informações correspondentes."],
    ["variations", "Variações, modelos ou tamanhos", "warning", "Quando fizer sentido para o produto, ofereça tamanhos, modelos, cores ou outras variações."],
    ["promotions", "Área de promoções", "error", "Inclua a área de promoções trabalhada no projeto-base usando produtos da própria loja."],
    ["carousel", "Carrossel de promoções", "warning", "Organize as ofertas em carrossel ou em um mecanismo equivalente de navegação."],
    ["contact", "Página ou área de contato", "error", "Mantenha uma área de contato identificável no projeto."],
    ["lazy", "Carregamento otimizado de imagens", "warning", "Use loading=\"lazy\" nas imagens de produtos quando fizer sentido."]
].map(([key, label, severity, solution]) => ({ key, label, severity, solution }));

const DEFAULT_KEYS = FEATURE_DEFINITIONS.map(item => item.key);

const state = {
    reference: { ready: false, online: false, sha: null, requirements: FEATURE_DEFINITIONS },
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
    ].forEach(id => { els[id] = document.getElementById(id); });
}

function bindEvents() {
    if (!els.chooseZipBtn || !els.chooseFolderBtn || !els.zipInput || !els.folderInput) {
        console.error("CodeFix: elementos de upload não encontrados.");
        return;
    }

    els.chooseZipBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        els.zipInput.value = "";
        els.zipInput.click();
    });

    els.chooseFolderBtn.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await chooseFolder();
    });

    els.zipInput.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (file) await loadZip(file);
    });

    els.folderInput.addEventListener("change", async event => {
        const files = event.target.files;
        if (files?.length) await loadFolderFileList(files);
    });

    els.dropZone?.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        els.zipInput.value = "";
        els.zipInput.click();
    });

    els.dropZone?.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            els.zipInput.value = "";
            els.zipInput.click();
        }
    });

    ["dragenter", "dragover"].forEach(type => els.dropZone?.addEventListener(type, event => {
        event.preventDefault();
        els.dropZone.classList.add("dragging");
    }));

    ["dragleave", "drop"].forEach(type => els.dropZone?.addEventListener(type, event => {
        event.preventDefault();
        els.dropZone.classList.remove("dragging");
    }));

    els.dropZone?.addEventListener("drop", async event => {
        const items = Array.from(event.dataTransfer?.items || []);
        const firstFile = event.dataTransfer?.files?.[0];

        if (firstFile?.name?.toLowerCase().endsWith(".zip")) {
            await loadZip(firstFile);
            return;
        }

        const dirItem = items.find(item => item.kind === "file" && item.webkitGetAsEntry?.()?.isDirectory);
        if (dirItem) {
            setUploadMessage("Para garantir que todas as subpastas sejam lidas, use o botão ‘Selecionar pasta’.", true);
            return;
        }

        setUploadMessage("Arraste um .ZIP ou use ‘Selecionar pasta’ para enviar a pasta já extraída.", true);
    });

    els.analyzeBtn?.addEventListener("click", runAnalysis);
    els.syncReferenceBtn?.addEventListener("click", () => syncReference(true));
    els.diagnosticFilter?.addEventListener("change", renderDiagnostics);
    els.newAnalysisBtn?.addEventListener("click", resetForNewAnalysis);
}

async function chooseFolder() {
    setUploadMessage("Selecione a pasta principal do seu projeto.", false);

    if (typeof window.showDirectoryPicker === "function") {
        try {
            const handle = await window.showDirectoryPicker({ mode: "read" });
            const raw = new Map();
            await readDirectoryHandle(handle, "", raw);
            setSelectedProject(handle.name || "Pasta do projeto", raw, "folder");
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
            console.warn("CodeFix: seletor moderno de pasta falhou, usando modo compatível.", error);
        }
    }

    els.folderInput.value = "";
    els.folderInput.click();
}

async function readDirectoryHandle(directoryHandle, prefix, raw) {
    for await (const [name, handle] of directoryHandle.entries()) {
        if (IGNORED_PARTS.has(name) || name === ".DS_Store" || name === "Thumbs.db") continue;
        const path = normalizePath(prefix ? `${prefix}/${name}` : name);
        if (handle.kind === "directory") {
            await readDirectoryHandle(handle, path, raw);
        } else if (handle.kind === "file") {
            const file = await handle.getFile();
            raw.set(path, await browserFileToRecord(file, path));
        }
    }
}

async function loadFolderFileList(fileList) {
    setUploadMessage("Lendo a pasta do projeto...", false);
    try {
        const files = Array.from(fileList);
        const raw = new Map();

        for (const file of files) {
            const originalPath = file.webkitRelativePath || file.name;
            const path = normalizePath(originalPath);
            if (!path || shouldIgnorePath(path)) continue;
            raw.set(path, await browserFileToRecord(file, path));
        }

        const projectName = detectTopFolder(files.map(file => file.webkitRelativePath || file.name)) || "Pasta do projeto";
        setSelectedProject(projectName, stripCommonRoot(raw), "folder");
    } catch (error) {
        console.error(error);
        setUploadMessage("Não consegui ler essa pasta. Tente novamente ou compacte a pasta em .ZIP.", true);
    }
}

async function loadZip(file) {
    setUploadMessage(`Abrindo ${file.name}...`, false);

    if (!file.name.toLowerCase().endsWith(".zip")) {
        setUploadMessage("Selecione um arquivo com extensão .ZIP.", true);
        return;
    }

    if (file.size > MAX_ZIP_SIZE) {
        setUploadMessage("O .ZIP ultrapassa 50 MB. Remova arquivos desnecessários e tente novamente.", true);
        return;
    }

    try {
        let raw;
        if (window.JSZip) {
            try {
                raw = await readZipWithJSZip(file);
            } catch (error) {
                console.warn("CodeFix: JSZip falhou, usando leitor nativo.", error);
                raw = await readZipNative(file);
            }
        } else {
            raw = await readZipNative(file);
        }

        const name = file.name.replace(/\.zip$/i, "") || "Projeto compactado";
        setSelectedProject(name, stripCommonRoot(raw), "zip");
    } catch (error) {
        console.error(error);
        setUploadMessage("Não consegui abrir esse .ZIP. Tente compactar a pasta novamente ou use ‘Selecionar pasta’.", true);
    }
}

async function readZipWithJSZip(file) {
    const zip = await window.JSZip.loadAsync(file);
    const raw = new Map();
    const entries = Object.values(zip.files).filter(entry => !entry.dir && !shouldIgnorePath(entry.name));

    for (const entry of entries) {
        const path = normalizePath(entry.name);
        const ext = getExtension(path);
        let content = null;
        let size = 0;

        if (TEXT_EXTENSIONS.has(ext)) {
            content = await entry.async("string");
            size = new Blob([content]).size;
            if (size > MAX_TEXT_FILE_SIZE) content = null;
        } else {
            const data = await entry.async("uint8array");
            size = data.byteLength;
        }
        raw.set(path, { path, content, size });
    }
    return raw;
}

async function readZipNative(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const eocd = findEndOfCentralDirectory(view);
    if (eocd < 0) throw new Error("Estrutura ZIP inválida.");

    const totalEntries = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder("utf-8");
    const raw = new Map();

    for (let i = 0; i < totalEntries; i += 1) {
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Diretório central inválido.");

        const flags = view.getUint16(offset + 8, true);
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const uncompressedSize = view.getUint32(offset + 24, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
        const name = decoder.decode(nameBytes);
        const path = normalizePath(name);

        offset += 46 + nameLength + extraLength + commentLength;

        if (!path || name.endsWith("/") || shouldIgnorePath(path)) continue;
        if (flags & 0x1) throw new Error("ZIP protegido por senha não é suportado.");
        if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Entrada ZIP inválida.");

        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);
        const ext = getExtension(path);
        let content = null;

        if (TEXT_EXTENSIONS.has(ext) && uncompressedSize <= MAX_TEXT_FILE_SIZE) {
            const unpacked = await decompressZipEntry(compressed, method);
            content = decoder.decode(unpacked);
        }

        raw.set(path, { path, content, size: uncompressedSize });
    }

    return raw;
}

function findEndOfCentralDirectory(view) {
    const min = Math.max(0, view.byteLength - 65557);
    for (let i = view.byteLength - 22; i >= min; i -= 1) {
        if (view.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
}

async function decompressZipEntry(compressed, method) {
    if (method === 0) return compressed;
    if (method !== 8) throw new Error(`Método de compactação ZIP ${method} não suportado.`);
    if (typeof DecompressionStream !== "function") {
        throw new Error("Este navegador não oferece descompactação nativa.");
    }

    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function browserFileToRecord(file, path) {
    const ext = getExtension(path);
    let content = null;
    if (TEXT_EXTENSIONS.has(ext) && file.size <= MAX_TEXT_FILE_SIZE) content = await file.text();
    return { path, content, size: file.size };
}

function setSelectedProject(name, files, source) {
    if (!files?.size) {
        state.selected = null;
        els.analyzeBtn.disabled = true;
        els.selectedProject?.classList.add("hidden");
        setUploadMessage("A pasta/ZIP foi aberta, mas nenhum arquivo útil foi encontrado.", true);
        return;
    }

    const inventory = buildInventory(files);
    if (!inventory.html.length && !inventory.css.length && !inventory.js.length) {
        setUploadMessage("Arquivos recebidos, mas não encontrei HTML, CSS ou JavaScript. Confira se você selecionou a pasta correta.", true);
    } else {
        setUploadMessage(`Projeto recebido: ${inventory.html.length} HTML, ${inventory.css.length} CSS e ${inventory.js.length} JavaScript.`, false);
    }

    state.selected = { name, files, source };
    els.selectedProjectName.textContent = name;
    els.selectedProjectCount.textContent = `${files.size} arquivo${files.size === 1 ? "" : "s"}`;
    els.selectedProject.classList.remove("hidden");
    els.analyzeBtn.disabled = false;
    els.resultsSection.classList.add("hidden");
}

async function syncReference(userRequested = false) {
    setReferenceStatus("loading", "Sincronizando...", "Buscando a versão atual da branch main");
    if (els.syncReferenceBtn) els.syncReferenceBtn.disabled = true;

    try {
        const response = await fetch(REFERENCE.apiTree, { cache: "no-store" });
        if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`);
        const data = await response.json();
        const codeEntries = (data.tree || []).filter(entry => entry.type === "blob" && ["html", "htm", "css", "js", "mjs"].includes(getExtension(entry.path)));
        const referenceFiles = new Map();

        const settled = await Promise.allSettled(codeEntries.map(async entry => {
            const responseFile = await fetch(REFERENCE.rawBase + encodePathForUrl(entry.path), { cache: "no-store" });
            if (!responseFile.ok) throw new Error(entry.path);
            const content = await responseFile.text();
            return [normalizePath(entry.path), { path: normalizePath(entry.path), content, size: content.length }];
        }));

        settled.forEach(result => {
            if (result.status === "fulfilled") referenceFiles.set(result.value[0], result.value[1]);
        });

        const features = referenceFiles.size ? detectFeatures(referenceFiles) : {};
        const requirements = FEATURE_DEFINITIONS.filter(item => features[item.key]);
        state.reference = {
            ready: true,
            online: true,
            sha: data.sha || null,
            requirements: requirements.length ? requirements : FEATURE_DEFINITIONS
        };

        const shortSha = state.reference.sha ? state.reference.sha.slice(0, 7) : "atual";
        setReferenceStatus("ready", "Referência atualizada", `Versão ${shortSha} • ${codeEntries.length} arquivos de código`);
        if (userRequested) setUploadMessage("Projeto-base atualizado com sucesso.", false);
    } catch (error) {
        console.warn("CodeFix: referência online indisponível.", error);
        state.reference = { ready: true, online: false, sha: null, requirements: FEATURE_DEFINITIONS };
        setReferenceStatus("offline", "Referência local", "Usando os requisitos conhecidos do projeto-base");
    } finally {
        if (els.syncReferenceBtn) els.syncReferenceBtn.disabled = false;
    }
}

function setReferenceStatus(className, label, detail) {
    if (!els.referenceBadge || !els.referenceCommit) return;
    els.referenceBadge.className = `badge ${className}`;
    els.referenceBadge.textContent = label;
    els.referenceCommit.textContent = detail;
}

async function runAnalysis() {
    if (!state.selected) {
        setUploadMessage("Selecione primeiro o ZIP ou a pasta do projeto.", true);
        return;
    }

    els.analyzeBtn.disabled = true;
    els.resultsSection.classList.add("hidden");
    els.analysisProgress.classList.remove("hidden");
    els.progressTitle.textContent = "Lendo os arquivos do projeto...";
    els.progressText.textContent = "Separando HTML, CSS, JavaScript e imagens.";
    await nextPaint();

    try {
        els.progressTitle.textContent = "Procurando problemas técnicos...";
        els.progressText.textContent = "Conferindo caminhos, links, funções, IDs e sintaxe básica.";
        await nextPaint();

        const result = analyzeProject(state.selected.files, state.reference.requirements);
        state.analysis = result;
        state.diagnostics = result.diagnostics;

        renderResults(result);
        els.analysisProgress.classList.add("hidden");
        els.resultsSection.classList.remove("hidden");
        els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error(error);
        els.analysisProgress.classList.add("hidden");
        els.analyzeBtn.disabled = false;
        setUploadMessage("O projeto foi recebido, mas ocorreu um erro durante a análise. Tente novamente.", true);
    }
}

function analyzeProject(files, requirements) {
    const diagnostics = [];
    const inventory = buildInventory(files);
    const paths = [...files.keys()];
    const lowerMap = new Map(paths.map(path => [path.toLowerCase(), path]));
    const allIds = new Set();
    const htmlDocs = [];
    const inlineJs = [];

    if (!inventory.html.length) {
        addDiag(diagnostics, "error", "Nenhuma página HTML encontrada", "Estrutura", "Não encontrei arquivos .html ou .htm.", "Inclua a página HTML principal dentro da pasta enviada.");
    } else {
        addDiag(diagnostics, "success", "Páginas HTML encontradas", "Estrutura", `${inventory.html.length} página(s) HTML encontrada(s).`, "Nenhuma correção necessária.");
    }

    inventory.html.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) return;
        const doc = new DOMParser().parseFromString(content, "text/html");
        htmlDocs.push({ path, doc });

        if (!/<!doctype\s+html/i.test(content)) {
            addDiag(diagnostics, "warning", "DOCTYPE não identificado", path, "A declaração <!DOCTYPE html> não foi localizada.", "Adicione <!DOCTYPE html> antes da tag <html>.");
        }

        const localIds = new Set();
        doc.querySelectorAll("[id]").forEach(el => {
            const id = el.id?.trim();
            if (!id) return;
            allIds.add(id);
            if (localIds.has(id)) addDiag(diagnostics, "warning", `ID duplicado: #${id}`, path, "O mesmo ID aparece mais de uma vez.", "Use esse ID em apenas um elemento ou troque os demais por classes/IDs diferentes.");
            localIds.add(id);
        });

        doc.querySelectorAll("script:not([src])").forEach(script => {
            if (script.textContent?.trim()) inlineJs.push(script.textContent);
        });

        analyzeReferences(path, doc, files, lowerMap, paths, diagnostics);
    });

    const jsCombined = [...inventory.js.map(path => files.get(path)?.content || ""), ...inlineJs].join("\n");
    analyzeJavaScript(inventory.js, files, jsCombined, allIds, htmlDocs, diagnostics);
    analyzeCss(inventory.css, files, diagnostics);

    if (inventory.css.length) addDiag(diagnostics, "success", "Arquivos CSS encontrados", "Estrutura", `${inventory.css.length} arquivo(s) CSS encontrado(s).`, "Nenhuma correção necessária.");
    if (inventory.js.length) addDiag(diagnostics, "success", "Arquivos JavaScript encontrados", "Estrutura", `${inventory.js.length} arquivo(s) JavaScript encontrado(s).`, "Nenhuma correção necessária.");
    if (inventory.images.length) addDiag(diagnostics, "success", "Imagens encontradas", "Estrutura", `${inventory.images.length} imagem(ns) encontrada(s).`, "Nenhuma correção necessária.");

    const features = detectFeatures(files);
    const reqs = (requirements?.length ? requirements : FEATURE_DEFINITIONS).map(req => {
        const met = Boolean(features[req.key]);
        if (met) {
            addDiag(diagnostics, "success", req.label, "Comparação com o projeto-base", "Esse recurso foi identificado no projeto, mesmo que a implementação seja diferente da do professor.", "Nenhuma correção necessária.");
        } else {
            addDiag(diagnostics, req.severity, `${req.label} não identificado`, "Comparação com o projeto-base", "Esse recurso existe na referência atual, mas não foi possível identificá-lo com segurança no projeto enviado.", req.solution);
        }
        return { ...req, met };
    });

    const counts = diagnostics.reduce((acc, item) => {
        acc[item.type] += 1;
        return acc;
    }, { success: 0, warning: 0, error: 0 });

    const score = Math.max(0, Math.min(100, 100 - counts.error * 7 - counts.warning * 2));
    return { diagnostics, inventory, requirements: reqs, features, counts, score };
}

function analyzeReferences(htmlPath, doc, files, lowerMap, paths, diagnostics) {
    const refs = [];
    doc.querySelectorAll("script[src]").forEach(el => refs.push([el.getAttribute("src"), "JavaScript", true]));
    doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(el => refs.push([el.getAttribute("href"), "CSS", true]));
    doc.querySelectorAll("img[src], source[src], video[poster]").forEach(el => refs.push([el.getAttribute("src") || el.getAttribute("poster"), "imagem", true]));
    doc.querySelectorAll("a[href]").forEach(el => refs.push([el.getAttribute("href"), "link", false]));

    refs.forEach(([rawValue, kind, critical]) => {
        const raw = (rawValue || "").trim();
        if (!raw || isExternalOrSpecial(raw)) return;
        const resolved = resolveRelativePath(htmlPath, raw);
        if (!resolved || files.has(resolved)) return;

        const caseMatch = lowerMap.get(resolved.toLowerCase());
        if (caseMatch) {
            addDiag(diagnostics, "warning", `Maiúsculas/minúsculas diferentes no caminho de ${kind}`, htmlPath, `O código aponta para “${raw}”, mas o arquivo encontrado é “${caseMatch}”.`, `Use exatamente o nome do arquivo: “${relativeSuggestion(htmlPath, caseMatch)}”.`);
            return;
        }

        const closest = findClosestPath(resolved, paths);
        const solution = closest
            ? `O arquivo mais parecido encontrado foi “${closest}”. Confira se o caminho deveria ser “${relativeSuggestion(htmlPath, closest)}”.`
            : "Confira o nome do arquivo, a pasta onde ele está salvo e a quantidade de ../ usada no caminho.";
        addDiag(diagnostics, critical ? "error" : "warning", `${capitalize(kind)} não encontrado(a)`, htmlPath, `“${raw}” aponta para “${resolved}”, mas esse arquivo não existe na pasta enviada.`, solution);
    });
}

function analyzeJavaScript(jsPaths, files, jsCombined, allIds, htmlDocs, diagnostics) {
    jsPaths.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) return;

        if (!/^\s*(?:import|export)\b/m.test(content)) {
            try { new Function(content); }
            catch (error) {
                addDiag(diagnostics, "error", "Possível erro de sintaxe JavaScript", path, String(error.message || error).slice(0, 220), "Revise chaves, parênteses, aspas, vírgulas e os blocos adicionados recentemente.");
            }
        }

        const regexes = [
            /getElementById\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
            /querySelector\s*\(\s*["'`]#([^"'`\s.:[\]>+~]+)["'`]\s*\)/g
        ];
        regexes.forEach(regex => {
            for (const match of content.matchAll(regex)) {
                const id = match[1];
                if (id && !allIds.has(id)) {
                    addDiag(diagnostics, "warning", `ID #${id} usado no JavaScript não foi encontrado`, path, `O JavaScript procura id="${id}", mas nenhum HTML enviado possui esse ID.`, `Confira se o ID foi renomeado. Ajuste o HTML ou o seletor JavaScript para que os dois usem o mesmo nome.`);
                }
            }
        });
    });

    const checked = new Set();
    htmlDocs.forEach(({ path, doc }) => {
        doc.querySelectorAll("*").forEach(element => {
            [...element.attributes].forEach(attribute => {
                if (!attribute.name.toLowerCase().startsWith("on")) return;
                for (const match of attribute.value.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
                    const name = match[1];
                    const key = `${path}:${name}`;
                    if (checked.has(key) || ["alert", "confirm", "prompt", "open", "print", "setTimeout", "setInterval"].includes(name)) continue;
                    checked.add(key);
                    if (!hasFunction(jsCombined, name)) {
                        addDiag(diagnostics, "error", `Função ${name}() não foi encontrada`, path, `O HTML chama ${name}(), mas não encontrei essa função nos JavaScripts enviados.`, `Procure por “function ${name}” no projeto. Se ela foi renomeada, atualize o HTML; se foi apagada, restaure a lógica correspondente.`);
                    }
                }
            });
        });
    });
}

function analyzeCss(cssPaths, files, diagnostics) {
    cssPaths.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) return;
        const clean = content.replace(/\/\*[\s\S]*?\*\//g, "");
        const open = (clean.match(/\{/g) || []).length;
        const close = (clean.match(/\}/g) || []).length;
        if (open !== close) addDiag(diagnostics, "warning", "Quantidade de chaves CSS não confere", path, `Foram encontradas ${open} chaves de abertura e ${close} de fechamento.`, "Revise os blocos CSS e confira se cada { possui uma } correspondente.");
    });
}

function detectFeatures(files) {
    const inv = buildInventory(files);
    const html = inv.html.map(path => files.get(path)?.content || "").join("\n").toLowerCase();
    const js = inv.js.map(path => files.get(path)?.content || "").join("\n").toLowerCase();
    const all = `${html}\n${js}`;
    let htmlLinks = 0;
    let searchInputs = 0;
    let productSignals = 0;

    inv.html.forEach(path => {
        const content = files.get(path)?.content;
        if (!content) return;
        const doc = new DOMParser().parseFromString(content, "text/html");
        doc.querySelectorAll("a[href]").forEach(a => {
            const href = (a.getAttribute("href") || "").toLowerCase();
            if (href.includes(".html") && !isExternalOrSpecial(href)) htmlLinks += 1;
        });
        doc.querySelectorAll('input[type="search"], input[type="text"]').forEach(input => {
            const signal = `${input.id} ${input.className} ${input.getAttribute("placeholder") || ""}`.toLowerCase();
            if (/pesquis|busc|procur|search/.test(signal)) searchInputs += 1;
        });
        productSignals += doc.querySelectorAll("article, .produto, [class*='produto'], [class*='product'], [data-categoria], [data-category]").length;
    });

    return {
        structure: inv.html.length > 0 && inv.css.length > 0 && (inv.js.length > 0 || /<script[\s>]/.test(html)),
        navigation: inv.html.length >= 2 && htmlLinks >= 2,
        products: /produto|product/.test(all) && (/r\$\s*\d|pre[cç]o|price/.test(all)) && (productSignals >= 2 || /const\s+produtos|let\s+produtos|produtos\s*=/.test(js)),
        search: searchInputs > 0 && /includes\s*\(|filter\s*\(|tolowercase\s*\(|filtrar|pesquis|buscar/.test(js),
        categories: /data-categoria|data-category|categoria|category/.test(all) && /dataset\.(categoria|category)|filtrarcategoria|categoria\s*===|category\s*===/.test(js),
        productDetail: /urlsearchparams|location\.search|\?id=|params\.get|parametros\.get/.test(js) && /descri[cç][aã]o|modelo|varia[cç][aã]o|tamanho|detalhe/.test(all),
        variations: /varia[cç][aã]|tamanho|modelo|cor selecion|op[cç][aã]o/.test(all),
        promotions: /promo[cç][aã]|oferta|desconto/.test(all),
        carousel: /carrossel|carousel|movercarrossel|slide/.test(all),
        contact: /contato|contact|type=["']email["']|mailto:|telefone|whatsapp/.test(all),
        lazy: /loading\s*=\s*["']lazy["']/.test(html)
    };
}

function renderResults(result) {
    const label = els.studentName?.value.trim();
    els.resultProjectName.textContent = label || state.selected.name;
    els.resultReferenceInfo.textContent = state.reference.online && state.reference.sha
        ? `Comparado com a versão ${state.reference.sha.slice(0, 7)} do projeto-base do professor.`
        : "Comparado com os requisitos conhecidos do projeto-base do professor.";

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

function renderDiagnostics() {
    const filter = els.diagnosticFilter?.value || "all";
    const list = filter === "all" ? state.diagnostics : state.diagnostics.filter(item => item.type === filter);
    if (!list.length) {
        els.diagnosticsList.innerHTML = '<div class="empty-state">Nenhum diagnóstico nesta categoria.</div>';
        return;
    }

    els.diagnosticsList.innerHTML = list.map(item => `
        <article class="diagnostic-card ${item.type}">
            <div class="diagnostic-top">
                <span class="diagnostic-status">${item.type === "error" ? "ERRO" : item.type === "warning" ? "ATENÇÃO" : "APROVADO"}</span>
                <span class="diagnostic-file">${escapeHTML(item.location)}</span>
            </div>
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(item.explanation)}</p>
            <div class="solution-box">
                <strong>${item.type === "success" ? "RESULTADO" : "COMO CORRIGIR"}</strong>
                <p>${escapeHTML(item.solution)}</p>
            </div>
        </article>
    `).join("");
}

function renderFileSummary(inv) {
    const rows = [["HTML", inv.html.length], ["CSS", inv.css.length], ["JavaScript", inv.js.length], ["Imagens", inv.images.length], ["Outros", inv.other.length], ["Total", inv.total]];
    els.fileSummary.innerHTML = rows.map(([label, value]) => `<div class="summary-row"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderRequirementsSummary(requirements) {
    els.requirementsSummary.innerHTML = requirements.map(item => `
        <div class="requirement-row">
            <span>${escapeHTML(item.label)}</span>
            <strong class="${item.met ? "met" : item.severity === "warning" ? "optional" : "missing"}">${item.met ? "OK" : "REVISAR"}</strong>
        </div>
    `).join("");
}

function resetForNewAnalysis() {
    state.selected = null;
    state.analysis = null;
    state.diagnostics = [];
    els.zipInput.value = "";
    els.folderInput.value = "";
    els.selectedProject.classList.add("hidden");
    els.analyzeBtn.disabled = true;
    els.resultsSection.classList.add("hidden");
    setUploadMessage("Selecione outro .ZIP ou outra pasta para analisar.", false);
    document.getElementById("analisador")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildInventory(files) {
    const inv = { total: files.size, html: [], css: [], js: [], images: [], other: [] };
    for (const path of files.keys()) {
        const ext = getExtension(path);
        if (["html", "htm"].includes(ext)) inv.html.push(path);
        else if (ext === "css") inv.css.push(path);
        else if (["js", "mjs"].includes(ext)) inv.js.push(path);
        else if (IMAGE_EXTENSIONS.has(ext)) inv.images.push(path);
        else inv.other.push(path);
    }
    return inv;
}

function addDiag(list, type, title, location, explanation, solution) {
    list.push({ type, title, location, explanation, solution });
}

function setUploadMessage(message, isError) {
    if (!els.uploadMessage) return;
    els.uploadMessage.textContent = message;
    els.uploadMessage.classList.toggle("error", Boolean(isError));
}

function hasFunction(source, name) {
    const escaped = escapeRegex(name);
    return new RegExp(`(?:function\\s+${escaped}\\s*\\(|(?:const|let|var)\\s+${escaped}\\s*=|${escaped}\\s*=\\s*(?:function|\\([^)]*\\)\\s*=>))`).test(source);
}

function isExternalOrSpecial(value) {
    const v = String(value || "").trim().toLowerCase();
    return !v || v.startsWith("http://") || v.startsWith("https://") || v.startsWith("//") || v.startsWith("data:") || v.startsWith("mailto:") || v.startsWith("tel:") || v.startsWith("javascript:") || v.startsWith("#");
}

function resolveRelativePath(baseFile, raw) {
    const clean = safeDecode(String(raw).split("#")[0].split("?")[0].replace(/\\/g, "/").trim());
    if (!clean) return null;
    const parts = clean.startsWith("/") ? [] : normalizePath(baseFile).split("/").slice(0, -1);
    clean.split("/").forEach(part => {
        if (!part || part === ".") return;
        if (part === "..") parts.pop();
        else parts.push(part);
    });
    return normalizePath(parts.join("/"));
}

function relativeSuggestion(fromFile, targetFile) {
    const from = normalizePath(fromFile).split("/").slice(0, -1);
    const target = normalizePath(targetFile).split("/");
    let common = 0;
    while (common < from.length && common < target.length && from[common] === target[common]) common += 1;
    return [...from.slice(common).map(() => ".."), ...target.slice(common)].join("/") || targetFile;
}

function findClosestPath(target, paths) {
    const base = basename(target).toLowerCase();
    const exactBase = paths.find(path => basename(path).toLowerCase() === base);
    if (exactBase) return exactBase;
    const ext = getExtension(target);
    const sameExt = paths.filter(path => getExtension(path) === ext).slice(0, 150);
    let best = null;
    let score = Infinity;
    sameExt.forEach(path => {
        const current = levenshtein(target.toLowerCase(), path.toLowerCase());
        if (current < score) { score = current; best = path; }
    });
    return score <= Math.max(4, Math.floor(target.length * 0.35)) ? best : null;
}

function stripCommonRoot(files) {
    const paths = [...files.keys()];
    if (!paths.length || paths.some(path => !path.includes("/"))) return files;
    const first = paths[0].split("/")[0];
    if (!paths.every(path => path.split("/")[0] === first)) return files;
    const result = new Map();
    files.forEach((record, path) => {
        const nextPath = path.split("/").slice(1).join("/");
        if (nextPath) result.set(nextPath, { ...record, path: nextPath });
    });
    return result;
}

function detectTopFolder(paths) {
    const normalized = paths.map(normalizePath).filter(Boolean);
    if (!normalized.length) return null;
    const first = normalized[0].split("/")[0];
    return normalized.every(path => path.split("/")[0] === first) ? first : null;
}

function shouldIgnorePath(path) {
    return normalizePath(path).split("/").some(part => IGNORED_PARTS.has(part) || part === ".DS_Store" || part === "Thumbs.db");
}

function normalizePath(path) {
    const out = [];
    String(path || "").replace(/\\/g, "/").split("/").forEach(part => {
        if (!part || part === ".") return;
        if (part === "..") out.pop();
        else out.push(part);
    });
    return out.join("/");
}

function encodePathForUrl(path) { return normalizePath(path).split("/").map(encodeURIComponent).join("/"); }
function getExtension(path) { const name = basename(path); return name.includes(".") ? name.split(".").pop().toLowerCase() : ""; }
function basename(path) { return normalizePath(path).split("/").pop() || ""; }
function capitalize(text) { return text ? text[0].toUpperCase() + text.slice(1) : text; }
function safeDecode(value) { try { return decodeURIComponent(value); } catch { return value; } }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeHTML(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
function scoreMessage(score, errors) { if (score >= 92 && errors === 0) return "Projeto muito consistente com os recursos analisados."; if (score >= 80) return "Projeto bem encaminhado. Revise os itens destacados."; if (score >= 60) return "Há pontos importantes para corrigir antes de concluir."; return "Comece corrigindo os erros em vermelho e analise novamente depois."; }
function nextPaint() { return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }

function levenshtein(a, b) {
    const row = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j += 1) {
        let prev = row[0];
        row[0] = j;
        for (let i = 1; i <= a.length; i += 1) {
            const temp = row[i];
            row[i] = Math.min(row[i] + 1, row[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = temp;
        }
    }
    return row[a.length];
}
