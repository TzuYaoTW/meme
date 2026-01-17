const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('textInput');
const fontSizeInput = document.getElementById('fontSize');
const fontWeightInput = document.getElementById('fontWeight');
const fontColorInput = document.getElementById('fontColor');
const downloadBtn = document.getElementById('downloadBtn');
const backBtn = document.getElementById('backBtn');
const confirmSelection = document.getElementById('confirmSelection');
const imageGrid = document.getElementById('imageGrid');
const pageGallery = document.getElementById('pageGallery');
const pageEditor = document.getElementById('pageEditor');
const subTitle = document.getElementById('subTitle');

let presets = [];

let currentImg = new Image();
let selectedImagePath = null;
let textPos = { x: 0, y: 0 };
let isDragging = false;
let isResizing = false;
let initialPinchDistance = null;
let initialFontSize = null;
let resizeBase = { x: 0, y: 0, size: 0 };

// 初始化
async function init() {
    try {
        const response = await fetch('images.json');
        presets = await response.json();
        renderGallery();
    } catch (err) {
        console.error('無法載入圖片清單:', err);
    }

    // 確認選擇按鈕
    confirmSelection.onclick = () => {
        if (selectedImagePath) {
            goToEditor(selectedImagePath);
        }
    };

    // 返回按鈕
    backBtn.onclick = goToGallery;

    // 編輯器事件監聽
    textInput.oninput = draw;
    fontSizeInput.oninput = draw;
    fontWeightInput.oninput = draw;
    fontColorInput.oninput = draw;

    // 滑鼠/觸控拖曳文字
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches[0]) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    // 滑鼠事件
    canvas.addEventListener('mousedown', (e) => {
        const pos = getPos(e);
        startDrag(pos.x, pos.y);
    });
    canvas.addEventListener('mousemove', (e) => {
        const pos = getPos(e);
        drag(pos.x, pos.y);
    });
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', endDrag);

    // 觸控事件 (重要：需設定 passive: false 才能 preventDefault)
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // 雙指縮放開始
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialFontSize = parseInt(fontSizeInput.value);
            e.preventDefault();
        } else {
            const pos = getPos(e);
            if (startDrag(pos.x, pos.y)) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            // 雙指縮放中
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scale = currentDistance / initialPinchDistance;
            let newSize = Math.round(initialFontSize * scale);

            // 限制範圍並更新輸入框
            newSize = Math.max(10, Math.min(300, newSize));
            fontSizeInput.value = newSize;
            draw();
            e.preventDefault();
        } else if (isDragging) {
            const pos = getPos(e);
            drag(pos.x, pos.y);
            e.preventDefault(); // 防止滾動
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        endDrag();
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
    });
    canvas.addEventListener('touchcancel', () => {
        endDrag();
        initialPinchDistance = null;
    });

    // 滑鼠移動時改變指標 (如果滑鼠在手把上方)
    canvas.addEventListener('mousemove', (e) => {
        const pos = getPos(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = pos.x * scaleX;
        const canvasY = pos.y * scaleY;

        if (canvas.handleRect &&
            canvasX >= canvas.handleRect.x1 && canvasX <= canvas.handleRect.x2 &&
            canvasY >= canvas.handleRect.y1 && canvasY <= canvas.handleRect.y2) {
            canvas.style.cursor = 'nwse-resize';
        } else if (canvas.textRect &&
            canvasX >= canvas.textRect.x1 && canvasX <= canvas.textRect.x2 &&
            canvasY >= canvas.textRect.y1 && canvasY <= canvas.textRect.y2) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    });

    // 滑鼠滾輪縮放 (保留作為輔助)
    canvas.addEventListener('wheel', (e) => {
        const pos = getPos(e);
        // 如果在文字範圍內捲動，則縮放文字
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = pos.x * scaleX;
        const canvasY = pos.y * scaleY;

        if (canvas.textRect &&
            canvasX >= canvas.textRect.x1 && canvasX <= canvas.textRect.x2 &&
            canvasY >= canvas.textRect.y1 && canvasY <= canvas.textRect.y2) {

            e.preventDefault();
            let currentSize = parseInt(fontSizeInput.value);
            const delta = e.deltaY > 0 ? -5 : 5;
            let newSize = Math.max(10, Math.min(300, currentSize + delta));

            fontSizeInput.value = newSize;
            draw();
        }
    }, { passive: false });

    downloadBtn.onclick = downloadImage;
}

function renderGallery() {
    // 使用 Intersection Observer 實作延遲載入效果
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const item = entry.target;
                const path = item.dataset.src;

                // 模擬預載圖片以確保流暢顯示
                const tempImg = new Image();
                tempImg.onload = () => {
                    item.style.backgroundImage = `url(${path})`;
                    item.classList.add('loaded');
                };
                tempImg.src = path;

                observer.unobserve(item);
            }
        });
    }, { rootMargin: '50px' });

    presets.forEach((path) => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.dataset.src = path;

        item.onclick = () => {
            document.querySelectorAll('.grid-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectedImagePath = path;
            confirmSelection.disabled = false;
        };

        imageGrid.appendChild(item);
        observer.observe(item);
    });
}

function goToEditor(path) {
    pageGallery.style.display = 'none';
    pageEditor.style.display = 'block';
    subTitle.innerText = '編輯您的文字與樣式';

    currentImg.onload = () => {
        canvas.width = currentImg.width;
        canvas.height = currentImg.height;
        textPos = { x: canvas.width / 2, y: canvas.height / 2 };
        draw();
    };
    currentImg.src = path;
}

function goToGallery() {
    pageGallery.style.display = 'block';
    pageEditor.style.display = 'none';
    subTitle.innerText = '簡單、直覺的圖文創作工具';
}

function draw(exportMode = false) {
    if (!currentImg.complete) return;

    // 清空並畫底圖
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImg, 0, 0);

    // 設定文字樣式
    const size = parseInt(fontSizeInput.value);
    const weight = fontWeightInput.value;
    const color = fontColorInput.value;
    const text = textInput.value;

    ctx.font = `${weight} ${size}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    const lineHeight = size * 1.2;
    const totalHeight = lines.length * lineHeight;

    // 加上陰影與描邊
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = size / 10; // 邊框粗細隨字體大小調整
    ctx.strokeStyle = '#000000'; // 預設黑色邊框
    ctx.lineJoin = 'round';
    ctx.fillStyle = color;

    let maxWidth = 0;
    lines.forEach((line, index) => {
        const y = textPos.y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2);

        // 先畫描邊再填色
        ctx.strokeText(line, textPos.x, y);
        ctx.fillText(line, textPos.x, y);

        const metrics = ctx.measureText(line);
        if (metrics.width > maxWidth) maxWidth = metrics.width;
    });

    // 計算文字範圍 (Bounding Box)
    canvas.textRect = {
        x1: textPos.x - maxWidth / 2,
        y1: textPos.y - totalHeight / 2,
        x2: textPos.x + maxWidth / 2,
        y2: textPos.y + totalHeight / 2
    };

    // 繪製選取框與縮放手把 (僅在非導出模式且有文字時繪製)
    if (!exportMode && text.trim()) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = 'rgba(0, 122, 255, 0.6)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(
            canvas.textRect.x1 - 10,
            canvas.textRect.y1 - 10,
            (canvas.textRect.x2 - canvas.textRect.x1) + 20,
            (canvas.textRect.y2 - canvas.textRect.y1) + 20
        );

        const handleSize = Math.max(15, size / 5);
        const hx = canvas.textRect.x2 + 10;
        const hy = canvas.textRect.y2 + 10;

        ctx.fillStyle = '#007aff';
        ctx.setLineDash([]);
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);

        canvas.handleRect = {
            x1: hx - handleSize / 2,
            y1: hy - handleSize / 2,
            x2: hx + handleSize / 2,
            y2: hy + handleSize / 2
        };
        ctx.restore();
    }
}

function startDrag(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    // 優先判定是否點擊在「縮放手把」上
    if (canvas.handleRect &&
        canvasX >= canvas.handleRect.x1 && canvasX <= canvas.handleRect.x2 &&
        canvasY >= canvas.handleRect.y1 && canvasY <= canvas.handleRect.y2) {
        isResizing = true;
        resizeBase = {
            x: canvasX,
            y: canvasY,
            size: parseInt(fontSizeInput.value)
        };
        return true;
    }

    // 判定是否點擊在「文字主體」上
    if (canvas.textRect &&
        canvasX >= canvas.textRect.x1 && canvasX <= canvas.textRect.x2 &&
        canvasY >= canvas.textRect.y1 && canvasY <= canvas.textRect.y2) {
        isDragging = true;
        canvas.dragOffset = {
            x: canvasX - textPos.x,
            y: canvasY - textPos.y
        };
        return true;
    }
    return false;
}

function drag(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    if (isResizing) {
        // 縮放邏輯：計算與點擊起始點的水平位移來調整字體
        // 向右拉變大，向左拉變小
        const dx = canvasX - resizeBase.x;
        let newSize = resizeBase.size + dx * 0.5; // 0.5 是靈敏度係數

        newSize = Math.max(10, Math.min(500, Math.round(newSize)));
        fontSizeInput.value = newSize;
        draw();
    } else if (isDragging) {
        let newX = canvasX - canvas.dragOffset.x;
        let newY = canvasY - canvas.dragOffset.y;

        const size = parseInt(fontSizeInput.value);
        const margin = size / 2;

        newX = Math.max(margin, Math.min(canvas.width - margin, newX));
        newY = Math.max(margin, Math.min(canvas.height - margin, newY));

        textPos.x = newX;
        textPos.y = newY;
        draw();
    }
}

function endDrag() {
    isDragging = false;
    isResizing = false;
}

function downloadImage() {
    // 1. 強制進入輸出模式 (隱藏輔助線)
    draw(true);

    const text = textInput.value.trim();

    // 只取第一行作為檔名參考，並限制字數在 15 字以內
    let firstLine = text.split('\n')[0].substring(0, 15);

    // 嚴格過濾：只保留中文、英文、數字、底線、橫線
    let safeName = firstLine.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');

    // 如果過濾後為空，使用預設值
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalFileName = safeName ? `${safeName}_${timestamp}` : `meme_${timestamp}`;

    const link = document.createElement('a');
    link.download = `${finalFileName}.png`;
    link.href = canvas.toDataURL('image/png');

    // 某些瀏覽器需要將連結加入 body 才能點擊
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. 下載結束後切換回編輯模式 (顯示輔助線)
    draw(false);
}

init();
