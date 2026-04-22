// 監視したい特定の周波数 (Hz)
const targetFreq = 18000;

let audioContext:AudioContext;
let analyser:AnalyserNode;
let dataArray:Uint8Array<ArrayBuffer>;

const startBtn = document.getElementById('startBtn') as HTMLButtonElement;


startBtn.addEventListener('click', async () => {
    try {
        // マイクの使用許可を得る設定
        const constraints = {
            audio: {
                // 生の音を取りたいため、ブラウザによる加工を無効にする
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Audio APIのセットアップ
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext())();
        const source = audioContext.createMediaStreamSource(stream);
        
        // 音声解析ノードの作成
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // 細かさの設定 (2のべき乗)
        analyser.smoothingTimeConstant = 0.8; // 動きを滑らかにする
        source.connect(analyser);

        // 周波数データの格納先を準備
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        // サンプリングレートに基づいて、18kHzがどのインデックスにあるか計算
        // index = 周波数 / (サンプリングレート / FFTサイズ)
        const sampleRate = audioContext.sampleRate;
        const binIndex = Math.round(targetFreq / (sampleRate / analyser.fftSize));

        // UIの切り替え
        (document.getElementById('startBtn') as HTMLElement).style.display = 'none';
        (document.getElementById('radar-ui') as HTMLElement).style.display = 'block';

        // 描画ループの開始
        update(binIndex);
        
    } catch (err:any) {
        alert('マイクへのアクセスが拒否されたか、エラーが発生しました。\n' + err.message);
    }
});

function update(binIndex:number) {
    // 現在の周波数データを取得
    analyser.getByteFrequencyData(dataArray);
    
    // 全体の中での最大音量（ノイズフロア確認用）
    const maxInAll = Math.max(...dataArray);
    
    // ターゲット周波数とその前後の平均値を取る（誤差吸収のため）
    const strength = Math.round(((dataArray[binIndex - 1] || 0) + (dataArray[binIndex] || 0) + (dataArray[binIndex + 1] || 0)) / 3) || 0;
    
    const indicator = document.getElementById('indicator') as HTMLElement;
    const valSpan = document.getElementById('val') as HTMLElement;
    const maxValSpan = document.getElementById('maxVal') as HTMLElement;
    
    // 数値表示の更新
    valSpan.innerText = strength.toString();
    maxValSpan.innerText = maxInAll.toString();
    
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
    requestAnimationFrame(() => update(binIndex));
}