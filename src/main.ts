import { AudioReceiver } from "./AudioReceiver.js";

// 監視したい特定の周波数 (Hz)
const targetFreq = 18000;

const startBtn = document.getElementById('startBtn') as HTMLButtonElement;


startBtn.addEventListener('click', async () => {
    await AudioReceiver.init(targetFreq);
    (document.getElementById("targetFreq") as HTMLSpanElement).textContent = targetFreq.toString();
    startBtn.style.display = 'none';
    (document.getElementById('radar-ui') as HTMLElement).style.display = 'block';
    update();
});

function update() {
    // 信号強度を取得
    const strength = AudioReceiver.getStrength();
    
    const indicator = document.getElementById('indicator') as HTMLElement;
    const valSpan = document.getElementById('val') as HTMLElement;
    const maxValSpan = document.getElementById('maxVal') as HTMLElement;
    
    // 数値表示の更新
    valSpan.textContent = strength.toString();
    //maxValSpan.textContent = maxInAll.toString();
    
    // 強度に応じてインジケーターを大きく、赤くする
    const scale = 1 + (strength / 100); 
    const red = strength;               
    const blue = 255 - strength;        
    
    indicator.style.transform = `scale(${scale})`;
    indicator.style.background = `rgb(${red}, 50, ${blue})`;
    
    // 一定以上の強度で光らせる
    if (strength > 150) {
        indicator.style.boxShadow = `0 0 ${strength/2}px rgb(255, 0, 0)`;
    } else {
        indicator.style.boxShadow = `0 0 20px rgba(0, 50, 255, 0.2)`;
    }

    // 次のフレームで再描画
    requestAnimationFrame(() => update());
}