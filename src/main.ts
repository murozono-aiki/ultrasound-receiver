import { AudioReceiver } from "./AudioReceiver.js";

// 監視したい特定の周波数の初期値 (Hz)
const targetFreq1 = 18000;
const targetFreq2 = 19500;

const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const targetFreq1Input = document.getElementById('targetFreq1') as HTMLInputElement;
const targetFreq2Input = document.getElementById('targetFreq2') as HTMLInputElement;


startBtn.addEventListener('click', async () => {
    await AudioReceiver.init(targetFreq1, targetFreq2);
    targetFreq1Input.value = targetFreq1.toString();
    targetFreq2Input.value = targetFreq2.toString();
    startBtn.style.display = 'none';
    (document.getElementById('radar-ui') as HTMLElement).style.display = 'block';
    update();
});

function update() {
    // 信号強度を取得
    const allStrength = AudioReceiver.getStrength();
    const strength = allStrength.strength;
    
    const indicator = document.getElementById('indicator') as HTMLElement;
    const valSpan = document.getElementById('val') as HTMLElement;
    const maxValSpan = document.getElementById('maxVal') as HTMLElement;

    const indicator1 = document.getElementById('indicator1') as HTMLElement;
    const val1Span = document.getElementById('val1') as HTMLElement;
    const indicator2 = document.getElementById('indicator2') as HTMLElement;
    const val2Span = document.getElementById('val2') as HTMLElement;
    const indicator3 = document.getElementById('indicator3') as HTMLElement;
    const val3Span = document.getElementById('val3') as HTMLElement;
    
    // 数値表示の更新
    valSpan.textContent = strength.toString();
    //maxValSpan.textContent = maxInAll.toString();

    val1Span.textContent = allStrength.target1.toString();
    val2Span.textContent = allStrength.target2.toString();
    val3Span.textContent = allStrength.ref.toString();
    
    [[indicator, strength], [indicator1, allStrength.target1], [indicator2, allStrength.target2], [indicator3, allStrength.ref]].forEach(([indicator, strength]) => {
        indicator = indicator as HTMLElement;
        strength = strength as number;

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
    });

    // 次のフレームで再描画
    requestAnimationFrame(() => update());
}

targetFreq1Input.addEventListener('change', async () => {
    AudioReceiver.init(parseFloat(targetFreq1Input.value), parseFloat(targetFreq2Input.value));
});
targetFreq2Input.addEventListener('change', async () => {
    AudioReceiver.init(parseFloat(targetFreq1Input.value), parseFloat(targetFreq2Input.value));
});