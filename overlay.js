// ==UserScript==
// @name         Wplace Overlay Multi-chunk By Zary + HUD
// @namespace    http://tampermonkey.net/
// @version      0.5.8
// @description  Overlay multi-chunk para Wplace.live com HUD e seletor de overlay externo
// @author       llucarius & Zary & ChatGPT
// @match        https://wplace.live/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zarystore.net
// @license      MIT
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/overlay.js
// @downloadURL  https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/overlay.js
// ==/UserScript==

(async function () {
    'use strict';

    const CHUNK_WIDTH = 1000;
    const CHUNK_HEIGHT = 1000;

    const overlaysRaw = await fetchData();
    const overlays = [];

    let currentOverlayId = null;
    let overlayProgress = {};

    const overlayNames = [
        "Onça [1386, 2385]",
        "Pardo Moggada [2063, 3072]",
        "Evil Morty [2210, 1652]",
        "EVE-StelarBlade [3218, 1820]",
        "Onda Japonesa [3357, 2304]"
    ];

    function resetProgress() {
        overlayProgress = {};
        updateHUD();
    }

    for (const obj of overlaysRaw) {
        const { img, width, height } = await loadImage(obj.url);

        const startX = obj.chunk[0] * CHUNK_WIDTH + obj.coords[0];
        const startY = obj.chunk[1] * CHUNK_HEIGHT + obj.coords[1];
        const endX = startX + width;
        const endY = startY + height;

        const chunkStartX = Math.floor(startX / CHUNK_WIDTH);
        const chunkStartY = Math.floor(startY / CHUNK_HEIGHT);
        const chunkEndX = Math.floor((endX - 1) / CHUNK_WIDTH);
        const chunkEndY = Math.floor((endY - 1) / CHUNK_HEIGHT);

        const sourceCanvas = new OffscreenCanvas(width, height);
        const sourceCtx = sourceCanvas.getContext("2d");
        sourceCtx.drawImage(img, 0, 0, width, height);

        for (let cx = chunkStartX; cx <= chunkEndX; cx++) {
            for (let cy = chunkStartY; cy <= chunkEndY; cy++) {
                const chunkOffsetX = cx * CHUNK_WIDTH;
                const chunkOffsetY = cy * CHUNK_HEIGHT;

                const overlayCanvas = new OffscreenCanvas(CHUNK_WIDTH, CHUNK_HEIGHT);
                const overlayCtx = overlayCanvas.getContext("2d");

                const sx = Math.max(0, chunkOffsetX - startX);
                const sy = Math.max(0, chunkOffsetY - startY);
                const sw = Math.min(width - sx, CHUNK_WIDTH);
                const sh = Math.min(height - sy, CHUNK_HEIGHT);
                const dx = Math.max(0, startX - chunkOffsetX);
                const dy = Math.max(0, startY - chunkOffsetY);

                overlayCtx.clearRect(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT);
                overlayCtx.drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, sw, sh);

                overlays.push({
                    chunk: [cx, cy],
                    chunksString: `/${cx}/${cy}.png`,
                    imageData: overlayCtx.getImageData(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT)
                });
            }
        }
    }

    const OVERLAY_MODES = ["overlay", "original", "chunks"];
    let overlayMode = OVERLAY_MODES[0];

    // HUD container (sem seletor dentro)
    const hud = document.createElement("div");
    hud.style.position = "fixed";
    hud.style.top = "50px";
    hud.style.right = "10px";
    hud.style.zIndex = 99999;
    hud.style.backgroundColor = "rgba(0,0,0,0.75)";
    hud.style.color = "white";
    hud.style.padding = "10px";
    hud.style.fontFamily = "monospace, monospace";
    hud.style.fontSize = "13px";
    hud.style.borderRadius = "8px";
    hud.style.maxHeight = "400px";
    hud.style.overflowY = "auto";
    hud.style.userSelect = "none";
    hud.style.cursor = "move";
    hud.style.boxShadow = "0 0 8px rgba(0,255,0,0.7)";
    hud.style.width = "280px";
    hud.style.minWidth = "150px";
    hud.style.minHeight = "80px";
    hud.style.resize = "both";
    document.body.appendChild(hud);

    // Cabeçalho HUD
    const hudHeader = document.createElement("div");
    hudHeader.style.display = "flex";
    hudHeader.style.justifyContent = "space-between";
    hudHeader.style.alignItems = "center";
    hudHeader.style.marginBottom = "6px";
    hud.appendChild(hudHeader);

    const hudTitle = document.createElement("div");
    hudTitle.textContent = "Overlay HUD";
    hudTitle.style.fontWeight = "bold";
    hudHeader.appendChild(hudTitle);

    const minimizeBtn = document.createElement("button");
    minimizeBtn.textContent = "–";
    minimizeBtn.title = "Minimizar/Restaurar HUD";
    minimizeBtn.style.background = "transparent";
    minimizeBtn.style.color = "white";
    minimizeBtn.style.border = "none";
    minimizeBtn.style.fontSize = "18px";
    minimizeBtn.style.cursor = "pointer";
    minimizeBtn.style.userSelect = "none";
    minimizeBtn.style.marginLeft = "10px";
    hudHeader.appendChild(minimizeBtn);

    const hudContent = document.createElement("pre");
    hudContent.style.margin = 0;
    hudContent.style.whiteSpace = "pre-wrap";
    hud.appendChild(hudContent);

    let hudMinimized = false;
    minimizeBtn.onclick = () => {
        hudMinimized = !hudMinimized;
        hudContent.style.display = hudMinimized ? "none" : "block";
        minimizeBtn.textContent = hudMinimized ? "+" : "–";
    };

    function createColorBox(color) {
        const box = document.createElement("span");
        box.style.display = "inline-block";
        box.style.width = "14px";
        box.style.height = "14px";
        box.style.backgroundColor = color;
        box.style.border = "1px solid #aaa";
        box.style.marginRight = "6px";
        box.style.verticalAlign = "middle";
        box.style.borderRadius = "3px";
        return box;
    }

    function updateHUD() {
        if (overlayMode !== "overlay" || currentOverlayId === null) {
            hud.style.display = "none";
            return;
        }
        hud.style.display = "block";

        let totalGreenPixels = 0;
        let totalOverlayPixels = 0;
        const missingColorsCount = {};

        for (const key in overlayProgress) {
            const { greenPixels, totalOverlayPixels: chunkOverlayPixels, missingColorsCount: chunkColors } = overlayProgress[key];
            totalGreenPixels += greenPixels;
            totalOverlayPixels += chunkOverlayPixels;

            for (const color in chunkColors) {
                missingColorsCount[color] = (missingColorsCount[color] || 0) + chunkColors[color];
            }
        }

        const percent = totalOverlayPixels
            ? ((totalGreenPixels / totalOverlayPixels) * 100).toFixed(2)
            : "0.00";

        const missingPixels = totalOverlayPixels - totalGreenPixels;

        hudContent.innerHTML = '';

        if (missingPixels === 0) {
            hudContent.textContent = "✔️ Completo!";
        } else {
            const text = `Pixels Totais: ${totalOverlayPixels.toLocaleString()}\nPixels Faltando: ${missingPixels.toLocaleString()}\nProgresso: ${percent}%\n\nCores Faltando:\n`;
            hudContent.textContent = text;
            for (const [color, count] of Object.entries(missingColorsCount).sort((a,b) => b[1] - a[1])) {
                const line = document.createElement("div");
                const box = createColorBox(color);
                line.appendChild(box);
                line.appendChild(document.createTextNode(count.toLocaleString()));
                hudContent.appendChild(line);
            }
        }
    }

    // Atualiza HUD a cada 30 segundos
    setInterval(updateHUD, 30000);

    function rgbaToCss(r, g, b, a) {
        return `rgba(${r},${g},${b},${a/255})`;
    }

    fetch = new Proxy(fetch, {
        apply: async (target, thisArg, argList) => {
            const urlString = typeof argList[0] === "object" ? argList[0].url : argList[0];
            let url;

            try {
                url = new URL(urlString);
            } catch (e) {
                throw new Error("Invalid URL provided to fetch");
            }

            if (overlayMode === "overlay" && currentOverlayId !== null) {
                if (url.hostname === "backend.wplace.live" && url.pathname.startsWith("/files/")) {
                    for (const obj of overlays) {
                        if (url.pathname.endsWith(obj.chunksString)) {
                            const overlayObjIndex = overlaysRaw.findIndex(o => {
                                const startX = o.chunk[0] * CHUNK_WIDTH + o.coords[0];
                                const startY = o.chunk[1] * CHUNK_HEIGHT + o.coords[1];
                                const endX = startX + obj.imageData.width;
                                const endY = startY + obj.imageData.height;
                                const overlayChunkString = `/${obj.chunk[0]}/${obj.chunk[1]}.png`;
                                return overlayChunkString === obj.chunksString && overlaysRaw[currentOverlayId].chunk[0] === o.chunk[0] && overlaysRaw[currentOverlayId].chunk[1] === o.chunk[1];
                            });

                            if (overlayObjIndex !== currentOverlayId) continue;

                            const originalResponse = await target.apply(thisArg, argList);
                            const originalBlob = await originalResponse.blob();
                            const originalImage = await blobToImage(originalBlob);

                            const width = originalImage.width;
                            const height = originalImage.height;
                            const canvas = new OffscreenCanvas(width, height);
                            const ctx = canvas.getContext("2d", { willReadFrequently: true });

                            ctx.drawImage(originalImage, 0, 0, width, height);
                            const originalData = ctx.getImageData(0, 0, width, height);
                            const resultData = ctx.getImageData(0, 0, width, height);
                            const d1 = originalData.data;
                            const d2 = obj.imageData.data;
                            const dr = resultData.data;

                            let greenPixels = 0;
                            let totalOverlayPixels = 0;
                            const missingColorsCount = {};

                            for (let i = 0; i < d1.length; i += 4) {
                                const isTransparent = d2[i] === 0 && d2[i + 1] === 0 && d2[i + 2] === 0 && d2[i + 3] === 0;
                                const samePixel =
                                    d1[i] === d2[i] &&
                                    d1[i + 1] === d2[i + 1] &&
                                    d1[i + 2] === d2[i + 2] &&
                                    d1[i + 3] === d2[i + 3];

                                if (samePixel && !isTransparent) {
                                    dr[i] = 0;
                                    dr[i + 1] = 255;
                                    dr[i + 2] = 0;
                                    dr[i + 3] = 255;
                                    greenPixels++;
                                    totalOverlayPixels++;
                                } else if (!isTransparent) {
                                    dr[i] = d2[i];
                                    dr[i + 1] = d2[i + 1];
                                    dr[i + 2] = d2[i + 2];
                                    dr[i + 3] = d2[i + 3];

                                    totalOverlayPixels++;
                                    const rgbaColor = rgbaToCss(d2[i], d2[i + 1], d2[i + 2], d2[i + 3]);
                                    missingColorsCount[rgbaColor] = (missingColorsCount[rgbaColor] || 0) + 1;
                                }
                            }

                            ctx.putImageData(resultData, 0, 0);
                            const mergedBlob = await canvas.convertToBlob();

                            overlayProgress[obj.chunksString.slice(1, -4)] = { greenPixels, totalOverlayPixels, missingColorsCount };
                            updateHUD();

                            return new Response(mergedBlob, {
                                headers: { "Content-Type": "image/png" }
                            });
                        }
                    }
                }
            } else if (overlayMode === "chunks") {
                if (url.hostname === "backend.wplace.live" && url.pathname.startsWith("/files/")) {
                    const parts = url.pathname.split("/");
                    const [chunk1, chunk2] = [parts.at(-2), parts.at(-1).split(".")[0]];

                    const canvas = new OffscreenCanvas(CHUNK_WIDTH, CHUNK_HEIGHT);
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });

                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT);

                    ctx.font = '30px Arial';
                    ctx.fillStyle = 'red';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${chunk1}, ${chunk2}`, CHUNK_WIDTH / 2, CHUNK_HEIGHT / 2);

                    const mergedBlob = await canvas.convertToBlob();

                    return new Response(mergedBlob, {
                        headers: { "Content-Type": "image/png" }
                    });
                }
            }

            return target.apply(thisArg, argList);
        }
    });

    function fetchData() {
        return fetch("https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/imagens.js?" + Date.now())
            .then(res => res.json());
    }

    function blobToImage(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                resolve({
                    img,
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    function patchUI() {
        // Remove o early return, sempre tenta criar se não existir

        const buttonContainer = document.querySelector("div.gap-4:nth-child(1) > div:nth-child(2)");
        if (!buttonContainer) return;

        // Botão blend
        let blendButton = document.getElementById("overlay-blend-button");
        if (!blendButton) {
            blendButton = document.createElement("button");
            blendButton.id = "overlay-blend-button";
            blendButton.textContent = overlayMode.charAt(0).toUpperCase() + overlayMode.slice(1);
            blendButton.style.backgroundColor = "#0e0e0e7f";
            blendButton.style.color = "white";
            blendButton.style.border = "solid";
            blendButton.style.borderColor = "#1d1d1d7f";
            blendButton.style.borderRadius = "4px";
            blendButton.style.padding = "5px 10px";
            blendButton.style.cursor = "pointer";
            blendButton.style.backdropFilter = "blur(2px)";

            blendButton.addEventListener("click", () => {
                overlayMode = OVERLAY_MODES[(OVERLAY_MODES.indexOf(overlayMode) + 1) % OVERLAY_MODES.length];
                blendButton.textContent = overlayMode.charAt(0).toUpperCase() + overlayMode.slice(1);
                resetProgress();
                updateHUD();
            });

            buttonContainer.appendChild(blendButton);

            // Ajusta classes container
            buttonContainer.classList.remove("items-center");
            buttonContainer.classList.add("items-end");
        }

        // Seletor de overlay
        let overlaySelector = document.getElementById("overlay-selector");
        if (!overlaySelector) {
            overlaySelector = document.createElement("select");
            overlaySelector.id = "overlay-selector";
            overlaySelector.style.marginTop = "6px";
            overlaySelector.style.padding = "4px 6px";
            overlaySelector.style.backgroundColor = "#222";
            overlaySelector.style.color = "white";
            overlaySelector.style.border = "none";
            overlaySelector.style.borderRadius = "4px";
            overlaySelector.style.fontSize = "13px";
            overlaySelector.title = "Selecione o overlay";

            // Opção padrão "Nenhum"
            const noneOption = document.createElement("option");
            noneOption.value = "";
            noneOption.textContent = "Nenhum overlay";
            overlaySelector.appendChild(noneOption);

            overlaysRaw.forEach((overlay, idx) => {
                const opt = document.createElement("option");
                opt.value = idx;
                const name = overlayNames[idx] ?? `Overlay #${idx + 1}`;
                opt.textContent = name;
                overlaySelector.appendChild(opt);
            });

            overlaySelector.value = currentOverlayId !== null ? currentOverlayId : "";

            overlaySelector.addEventListener("change", (e) => {
                const val = e.target.value;
                if (val === "") {
                    currentOverlayId = null;
                } else {
                    currentOverlayId = Number(val);
                }
                resetProgress();
                updateHUD();
            });

            buttonContainer.appendChild(overlaySelector);
        }
    }

    // Arrastar HUD
    hudHeader.style.cursor = "move";
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    hudHeader.addEventListener("mousedown", (e) => {
        if (e.target === minimizeBtn) return;
        isDragging = true;
        dragOffsetX = e.clientX - hud.getBoundingClientRect().left;
        dragOffsetY = e.clientY - hud.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
    });

    window.addEventListener("mousemove", (e) => {
        if (isDragging) {
            hud.style.left = (e.clientX - dragOffsetX) + "px";
            hud.style.top = (e.clientY - dragOffsetY) + "px";
        }
    });

    // Observa o container para reaplicar patchUI quando for removido ou alterado (ex: repaint)
    const targetNode = document.querySelector("div.gap-4:nth-child(1)");
    if (targetNode) {
        const observer = new MutationObserver(() => {
            patchUI();
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }

    patchUI();

})();
