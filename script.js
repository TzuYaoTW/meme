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
    canvas.onmousedown = (e) => startDrag(e.offsetX, e.offsetY);
    canvas.onmousemove = (e) => drag(e.offsetX, e.offsetY);
    canvas.onmouseup = endDrag;
    canvas.onmouseleave = endDrag;

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

function draw() {
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
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 加上一點陰影增加可讀性
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(text, textPos.x, textPos.y);

    // 計算文字範圍 (Bounding Box) 用於拖曳判定
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = size;

    canvas.textRect = {
        x1: textPos.x - textWidth / 2,
        y1: textPos.y - textHeight / 2,
        x2: textPos.x + textWidth / 2,
        y2: textPos.y + textHeight / 2
    };
}

function startDrag(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    if (canvas.textRect &&
        canvasX >= canvas.textRect.x1 && canvasX <= canvas.textRect.x2 &&
        canvasY >= canvas.textRect.y1 && canvasY <= canvas.textRect.y2) {
        isDragging = true;
        canvas.dragOffset = {
            x: canvasX - textPos.x,
            y: canvasY - textPos.y
        };
    }
}

function drag(x, y) {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let newX = x * scaleX - canvas.dragOffset.x;
        let newY = y * scaleY - canvas.dragOffset.y;

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
}

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'my-creation.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

init();
