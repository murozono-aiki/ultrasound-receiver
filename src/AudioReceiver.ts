export class AudioReceiver {
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

    static getStrength(): number {
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
        if (finalStrength > 40) { // デュアルトーンは厳しい条件なので閾値は少し低め(40程度)でOK
            this.#consecutiveHits++;
        } else {
            this.#consecutiveHits = 0;
        }

        if (this.#consecutiveHits < this.#REQUIRED_HITS) return 0;

        return finalStrength;
    }
}