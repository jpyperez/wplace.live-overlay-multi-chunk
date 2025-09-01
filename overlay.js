// ==UserScript==
// @name         Wplace Overlay Multi-chunk + HUD By Zary
// @namespace    http://tampermonkey.net/
// @version      0.6.9
// @description  Overlay multi-chunk para Wplace.live com HUD, seletor de overlay, botão "Ir para Overlay" e filtro de cores faltantes.
// @author       Zary
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
    const selectedColors = []; // cores selecionadas no filtro

    const overlayNames = [
        "Onça",
        "Pardo Moggada",
        "Evil Morty",
        "EVE-StelarBlade",
        "Onda Japonesa",
        "Brasil Imperial"
    ];
    const overlayCoords = [
        { lat: -23.6260, lng: -46.8656 },
        { lat: -26.3495, lng: -45.8197 },
        { lat: -24.1511, lng: -46.0176 },
        { lat: 36.34, lng: 127.12 },
        { lat: 34.55, lng: 139.10 },
        { lat: -23.4968, lng: -47.0192 }
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
                    overlayId: overlaysRaw.indexOf(obj), // <- guarda o índice do overlay
                    chunk: [cx, cy],
                    chunksString: `/${cx}/${cy}.png`,
                    imageData: overlayCtx.getImageData(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT)
                });
            }
        }
    }

    const OVERLAY_MODES = ["overlay", "original", "chunks"];
    let overlayMode = OVERLAY_MODES[0];

    // HUD container
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
    hudTitle.textContent = "Overlay HUD - By Zary";
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

        const percent = totalOverlayPixels ? ((totalGreenPixels / totalOverlayPixels) * 100).toFixed(2) : "0.00";
        const missingPixels = totalOverlayPixels - totalGreenPixels;

        hudContent.innerHTML = '';

        if (missingPixels === 0) {
            hudContent.textContent = "✔️ Completo!";
        } else {
            const text = `Pixels Totais: ${totalOverlayPixels.toLocaleString()}\nPixels Faltando: ${missingPixels.toLocaleString()}\nProgresso: ${percent}%\n\nCores Faltando:\n`;
            hudContent.textContent = text;

            // Lista de cores com checkboxes
            for (const [color, count] of Object.entries(missingColorsCount).sort((a,b)=>b[1]-a[1])) {
                const line = document.createElement("div");
                const box = createColorBox(color);
                const label = document.createElement("label");
                label.style.cursor = "pointer";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = color;
                checkbox.checked = selectedColors.includes(color);
                checkbox.style.marginRight = "4px";
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        if (!selectedColors.includes(color)) selectedColors.push(color);
                    } else {
                        const idx = selectedColors.indexOf(color);
                        if (idx !== -1) selectedColors.splice(idx,1);
                    }
                    updateHUD();
                });
                label.appendChild(checkbox);
                label.appendChild(box);
                label.appendChild(document.createTextNode(count.toLocaleString()));
                line.appendChild(label);
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
                        if (obj.overlayId !== currentOverlayId) continue; // <- só pega o overlay selecionado
                        if (url.pathname.endsWith(obj.chunksString)) {
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

                            for (let i=0;i<d1.length;i+=4){
                                const isTransparent = d2[i]===0 && d2[i+1]===0 && d2[i+2]===0 && d2[i+3]===0;
                                const samePixel = d1[i]===d2[i] && d1[i+1]===d2[i+1] && d1[i+2]===d2[i+2] && d1[i+3]===d2[i+3];

                                const rgbaColor = rgbaToCss(d2[i], d2[i+1], d2[i+2], d2[i+3]);

                                if (samePixel && !isTransparent){
                                    dr[i]=0; dr[i+1]=255; dr[i+2]=0; dr[i+3]=255;
                                    greenPixels++;
                                    totalOverlayPixels++;
                                } else if (!isTransparent){
                                    // FILTRO DE CORES
                                    if (selectedColors.length===0 || selectedColors.includes(rgbaColor)){
                                        dr[i]=d2[i];
                                        dr[i+1]=d2[i+1];
                                        dr[i+2]=d2[i+2];
                                        dr[i+3]=d2[i+3];
                                    } else {
                                        dr[i+3] = 0; // transparente se não selecionada
                                    }
                                    totalOverlayPixels++;
                                    missingColorsCount[rgbaColor]=(missingColorsCount[rgbaColor]||0)+1;
                                }
                            }

                            ctx.putImageData(resultData,0,0);
                            const mergedBlob = await canvas.convertToBlob();
                            overlayProgress[obj.chunksString.slice(1,-4)]={greenPixels,totalOverlayPixels,missingColorsCount};
                            updateHUD();
                            return new Response(mergedBlob,{headers:{"Content-Type":"image/png"}});
                        }
                    }
                }
            }

            return target.apply(thisArg,argList);
        }
    });

    function fetchData() {
        return fetch("https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/imagens.js?" + Date.now())
            .then(res => res.json());
    }

    function blobToImage(blob){
        return new Promise((resolve,reject)=>{
            const img = new Image();
            img.onload=()=>resolve(img);
            img.onerror=reject;
            img.src=URL.createObjectURL(blob);
        });
    }

    function loadImage(src){
        return new Promise((resolve,reject)=>{
            const img = new Image();
            img.crossOrigin="anonymous";
            img.onload=()=>resolve({img,width:img.naturalWidth,height:img.naturalHeight});
            img.onerror=reject;
            img.src=src;
        });
    }

    function patchUI() {
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
                    resetProgress();
                    updateHUD();
                    patchGoToOverlayButton();
                }
            });

            buttonContainer.appendChild(overlaySelector);
        }

        patchGoToOverlayButton();
    }

    function patchGoToOverlayButton() {
        let gotoButton = document.getElementById("goto-overlay-btn");
        if (!gotoButton) {
            gotoButton = document.createElement("button");
            gotoButton.id = "goto-overlay-btn";
            gotoButton.textContent = "Ir para Overlay";
            gotoButton.style.marginLeft = "6px";
            gotoButton.style.padding = "4px 8px";
            gotoButton.style.borderRadius = "4px";
            gotoButton.style.border = "none";
            gotoButton.style.backgroundColor = "#0e0e0e7f";
            gotoButton.style.color = "white";
            gotoButton.style.cursor = "pointer";
            document.querySelector("#overlay-selector").after(gotoButton);

            gotoButton.addEventListener("click", () => {
                if (currentOverlayId === null) return;
                const coords = overlayCoords[currentOverlayId] ?? { lat: 0, lng: 0 };
                window.location.href = `https://wplace.live/?lat=${coords.lat}&lng=${coords.lng}`;
            });
        }
    }

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

    const targetNode = document.querySelector("div.gap-4:nth-child(1)");
    if (targetNode) {
        const observer = new MutationObserver(() => {
            patchUI();
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }

    patchUI();

})();
