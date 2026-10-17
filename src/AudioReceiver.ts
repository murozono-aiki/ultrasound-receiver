export class AudioReceiver {
    static #audioContext: AudioContext;
    static #analyser: AnalyserNode;
    static #dataArray: Uint8Array<ArrayBuffer>;

    static #receiverMode: {dualTone: boolean, TDMA: boolean} = {dualTone: false, TDMA: false};
    
    static #target1BinIndex: number;
    static #target2BinIndex: number;
    static #refBinIndex: number; // 2つの音の「谷間」をノイズ監視用とする
    static #lowFreqBinIndexMax: number;

    // --- チューニング用定数 ---
    static readonly #NOISE_PENALTY_WEIGHT = 1.2; 
    static readonly #LOW_FREQ_LIMIT_HZ = 500;
    static readonly #WIND_NOISE_THRESHOLD = 200;

    static #consecutiveHits = 0;
    static readonly #REQUIRED_HITS = 3;

    /**
     * @param freq1 1つ目の周波数（例：18000）
     * @param freq2 2つ目の周波数（例：19500）
     */
    static async init(mode: {dualTone: boolean, TDMA: boolean}, freq1: number, freq2: number): Promise<boolean> {
        this.#receiverMode = mode;
        try {
            if (!this.#audioContext) {
                const constraints = {
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = this.#audioContext.createMediaStreamSource(stream);
                
                this.#analyser = this.#audioContext.createAnalyser();
                this.#analyser.fftSize = 2048;
                this.#analyser.smoothingTimeConstant = 0.8;
                source.connect(this.#analyser);

                this.#dataArray = new Uint8Array(this.#analyser.frequencyBinCount);
            }
            
            const hzPerBin = this.#audioContext.sampleRate / this.#analyser.fftSize;

            // ターゲット帯域の計算
            this.#target1BinIndex = Math.round(freq1 / hzPerBin);
            this.#target2BinIndex = Math.round(freq2 / hzPerBin);
            
            // リファレンスは「2つの周波数の中間」とする（ここが鳴っていれば広帯域ノイズ）
            const refFreq = (freq1 + freq2) / 2;
            this.#refBinIndex = Math.round(refFreq / hzPerBin);
            
            // 鼻息ガード用の低音域
            this.#lowFreqBinIndexMax = Math.max(1, Math.round(this.#LOW_FREQ_LIMIT_HZ / hzPerBin));

            return true;
        } catch (err: any) {
            alert('マイクへのアクセスエラー:\n' + err.message);
            return false;
        }
    }

    // 指定したインデックスとその前後の平均値を取得するヘルパー関数
    static #getBinAverage(index: number): number {
        return (
            (this.#dataArray[index - 1] || 0) + 
            (this.#dataArray[index] || 0) + 
            (this.#dataArray[index + 1] || 0)
        ) / 3;
    }

    static getStrength(): {strength:number, target1:number, target2:number, ref:number} {
        if (!this.#analyser) throw new Error("AudioReceiver.initを実行する必要があります");
        this.#analyser.getByteFrequencyData(this.#dataArray);
        
        // 1. 低音域チェック
        /*let maxLowFreqEnergy = 0;
        for (let i = 0; i <= this.#lowFreqBinIndexMax; i++) {
            if (this.#dataArray[i] > maxLowFreqEnergy) maxLowFreqEnergy = this.#dataArray[i];
        }
        if (maxLowFreqEnergy > this.#WIND_NOISE_THRESHOLD) {
            this.#consecutiveHits = 0;
            return 0; 
        }*/

        // 2. 各帯域の強度を取得
        const t1Strength = this.#getBinAverage(this.#target1BinIndex);
        const t2Strength = this.#getBinAverage(this.#target2BinIndex);
        const refStrength = this.#getBinAverage(this.#refBinIndex); // 谷間

        // 3. デュアルトーンの評価（論理積）
        // 両方の音が鳴っている必要があるため、2つのうち「弱い方」をベースの強度とする
        const baseStrength = Math.min(t1Strength, t2Strength);

        // 4. 広帯域ノイズのペナルティ
        // 谷間（リファレンス）の音量が大きい場合は、風切り音などのノイズとみなして引く
        const effectiveStrength = baseStrength - (refStrength * this.#NOISE_PENALTY_WEIGHT);
        const finalStrength = Math.max(0, Math.round(effectiveStrength));

        // 5. 継続時間フィルター
        /*if (finalStrength > 40) { // デュアルトーンは厳しい条件なので閾値は少し低め(40程度)でOK
            this.#consecutiveHits++;
        } else {
            this.#consecutiveHits = 0;
        }

        if (this.#consecutiveHits < this.#REQUIRED_HITS) return {strength: 0, target1: Math.round(t1Strength), target2: Math.round(t2Strength), ref: Math.round(refStrength)};*/

        return {strength: finalStrength, target1: Math.round(t1Strength), target2: Math.round(t2Strength), ref: Math.round(refStrength)};
    }
}

export class AudioReceiverDualTone {
    static #audioContext: AudioContext;
    static #analyser: AnalyserNode;
    static #dataArray: Uint8Array<ArrayBuffer>;
    
    static #target1BinIndex: number;
    static #target2BinIndex: number;
    static #refBinIndex: number; // 2つの音の「谷間」をノイズ監視用とする
    static #lowFreqBinIndexMax: number;

    // --- チューニング用定数 ---
    static readonly #NOISE_PENALTY_WEIGHT = 1.2; 
    static readonly #LOW_FREQ_LIMIT_HZ = 500;
    static readonly #WIND_NOISE_THRESHOLD = 200;

    static #consecutiveHits = 0;
    static readonly #REQUIRED_HITS = 3;

    /**
     * @param freq1 1つ目の周波数（例：18000）
     * @param freq2 2つ目の周波数（例：19500）
     */
    static async init(freq1: number, freq2: number): Promise<boolean> {
        try {
            if (!this.#audioContext) {
                const constraints = {
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = this.#audioContext.createMediaStreamSource(stream);
                
                this.#analyser = this.#audioContext.createAnalyser();
                this.#analyser.fftSize = 2048;
                this.#analyser.smoothingTimeConstant = 0.8;
                source.connect(this.#analyser);

                this.#dataArray = new Uint8Array(this.#analyser.frequencyBinCount);
            }
            
            const hzPerBin = this.#audioContext.sampleRate / this.#analyser.fftSize;

            // ターゲット帯域の計算
            this.#target1BinIndex = Math.round(freq1 / hzPerBin);
            this.#target2BinIndex = Math.round(freq2 / hzPerBin);
            
            // リファレンスは「2つの周波数の中間」とする（ここが鳴っていれば広帯域ノイズ）
            const refFreq = (freq1 + freq2) / 2;
            this.#refBinIndex = Math.round(refFreq / hzPerBin);
            
            // 鼻息ガード用の低音域
            this.#lowFreqBinIndexMax = Math.max(1, Math.round(this.#LOW_FREQ_LIMIT_HZ / hzPerBin));

            return true;
        } catch (err: any) {
            alert('マイクへのアクセスエラー:\n' + err.message);
            return false;
        }
    }

    // 指定したインデックスとその前後の平均値を取得するヘルパー関数
    static #getBinAverage(index: number): number {
        return (
            (this.#dataArray[index - 1] || 0) + 
            (this.#dataArray[index] || 0) + 
            (this.#dataArray[index + 1] || 0)
        ) / 3;
    }

    static getStrength(): {strength:number, target1:number, target2:number, ref:number} {
        if (!this.#analyser) throw new Error("AudioReceiver.initを実行する必要があります");
        this.#analyser.getByteFrequencyData(this.#dataArray);
        
        // 1. 低音域チェック
        /*let maxLowFreqEnergy = 0;
        for (let i = 0; i <= this.#lowFreqBinIndexMax; i++) {
            if (this.#dataArray[i] > maxLowFreqEnergy) maxLowFreqEnergy = this.#dataArray[i];
        }
        if (maxLowFreqEnergy > this.#WIND_NOISE_THRESHOLD) {
            this.#consecutiveHits = 0;
            return 0; 
        }*/

        // 2. 各帯域の強度を取得
        const t1Strength = this.#getBinAverage(this.#target1BinIndex);
        const t2Strength = this.#getBinAverage(this.#target2BinIndex);
        const refStrength = this.#getBinAverage(this.#refBinIndex); // 谷間

        // 3. デュアルトーンの評価（論理積）
        // 両方の音が鳴っている必要があるため、2つのうち「弱い方」をベースの強度とする
        const baseStrength = Math.min(t1Strength, t2Strength);

        // 4. 広帯域ノイズのペナルティ
        // 谷間（リファレンス）の音量が大きい場合は、風切り音などのノイズとみなして引く
        const effectiveStrength = baseStrength - (refStrength * this.#NOISE_PENALTY_WEIGHT);
        const finalStrength = Math.max(0, Math.round(effectiveStrength));

        // 5. 継続時間フィルター
        /*if (finalStrength > 40) { // デュアルトーンは厳しい条件なので閾値は少し低め(40程度)でOK
            this.#consecutiveHits++;
        } else {
            this.#consecutiveHits = 0;
        }

        if (this.#consecutiveHits < this.#REQUIRED_HITS) return {strength: 0, target1: Math.round(t1Strength), target2: Math.round(t2Strength), ref: Math.round(refStrength)};*/

        return {strength: finalStrength, target1: Math.round(t1Strength), target2: Math.round(t2Strength), ref: Math.round(refStrength)};
    }
}

export class AudioReceiverTDMA {
    static #audioContext: AudioContext;
    static #analyser: AnalyserNode;
    static #dataArray: Uint8Array<ArrayBuffer>;
    static #targetBinIndex: number;

    // --- TDMA（時間分割）用の履歴バッファ ---
    // 過去の音量データを時間とともに記録する配列
    static #history: { time: number, energy: number }[] = [];

    // --- チューニング定数 ---
    // パルス周期(例: ON 100ms + OFF 100ms = 200ms)よりも少し長い時間を設定
    static readonly #WINDOW_MS = 300; 
    
    // 自然なノイズの微細な揺らぎ（パルスではない変動）を無視する閾値
    static readonly #NOISE_MARGIN = 0/*15*/; 

    static async init(targetFreq: number): Promise<boolean> {
        try {
            if (!this.#audioContext) {
                const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = this.#audioContext.createMediaStreamSource(stream);
                
                this.#analyser = this.#audioContext.createAnalyser();
                this.#analyser.fftSize = 2048;
                // パルスの山と谷をはっきりさせるため、平滑化を弱める
                this.#analyser.smoothingTimeConstant = 0.4; 
                source.connect(this.#analyser);

                this.#dataArray = new Uint8Array(this.#analyser.frequencyBinCount);
            }
            
            const hzPerBin = this.#audioContext.sampleRate / this.#analyser.fftSize;
            this.#targetBinIndex = Math.round(targetFreq / hzPerBin);

            return true;
        } catch (err: any) {
            alert('マイクエラー:\n' + err.message);
            return false;
        }
    }

    static getStrength(): number {
        if (!this.#analyser) throw new Error("AudioReceiverTDMA.initを実行する必要があります");
        this.#analyser.getByteFrequencyData(this.#dataArray);
        
        const now = performance.now();
        
        // 前後1ビンを含めた平均を取り、現在の生の強度(ノイズ込み)とする
        const currentEnergy = Math.round((
            (this.#dataArray[this.#targetBinIndex - 1] || 0) + 
            (this.#dataArray[this.#targetBinIndex] || 0) + 
            (this.#dataArray[this.#targetBinIndex + 1] || 0)
        ) / 3);

        // 1. 履歴バッファに現在のデータを追加
        this.#history.push({ time: now, energy: currentEnergy });

        // 2. 指定時間（WINDOW_MS）より古いデータをバッファから捨てる
        while (this.#history.length > 0 && now - this.#history[0]!.time > this.#WINDOW_MS) {
            this.#history.shift();
        }

        if (this.#history.length < 2) return 0;

        // 3. ウィンドウ内から「ONの最大値(max)」と「OFFの最小値(min)」を探す
        let minEnergy = 255;
        let maxEnergy = 0;
        for (const record of this.#history) {
            if (record.energy < minEnergy) minEnergy = record.energy;
            if (record.energy > maxEnergy) maxEnergy = record.energy;
        }

        // 4. TDMAキャンセレーション（引き算）の実行
        let trueStrength = maxEnergy - minEnergy;

        // 5. 微小な変動（ただの環境ノイズの揺らぎ）はゼロとみなす
        if (trueStrength < this.#NOISE_MARGIN) {
            return 0;
        }

        // 信号の強さ（振幅）を返す
        return trueStrength;
    }
}