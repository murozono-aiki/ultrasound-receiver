export class AudioReceiver {
    static #audioContext: AudioContext;
    static #analyser: AnalyserNode;
    static #dataArray: Uint8Array<ArrayBuffer>;
    
    static #targetBinIndex: number;
    static #refBinIndex: number; // 広帯域ノイズ判定用のリファレンスインデックス

    // チューニング用の定数
    // ターゲットより2000Hz下の帯域をノイズ判定の基準とする
    static readonly #REF_OFFSET_HZ = -2000; 
    // ノイズと判定した際の減衰係数（環境に合わせて1.0〜2.0程度で調整）
    static readonly #NOISE_PENALTY_WEIGHT = 1.2; 

    /**
     * マイクの使用許可を得て、聴音の準備をする
     * @param targetFreq 監視したい周波数（18000Hz ~ 20000Hz）
     */
    static async init(targetFreq: number): Promise<boolean> {
        try {
            if (!this.#audioContext) {
                const constraints = {
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = this.#audioContext.createMediaStreamSource(stream);
                
                this.#analyser = this.#audioContext.createAnalyser();
                this.#analyser.fftSize = 2048;
                this.#analyser.smoothingTimeConstant = 0.8;
                source.connect(this.#analyser);

                const bufferLength = this.#analyser.frequencyBinCount;
                this.#dataArray = new Uint8Array(bufferLength);
            }
            
            const sampleRate = this.#audioContext.sampleRate;
            const hzPerBin = sampleRate / this.#analyser.fftSize;

            // ターゲット帯域のインデックス計算
            this.#targetBinIndex = Math.round(targetFreq / hzPerBin);
            
            // リファレンス帯域（ノイズ検知用）のインデックス計算
            const refFreq = targetFreq + this.#REF_OFFSET_HZ;
            this.#refBinIndex = Math.round(refFreq / hzPerBin);

            return true;
        } catch (err: any) {
            alert('マイクへのアクセスが拒否されたか、エラーが発生しました。\n' + err.message);
            return false;
        }
    }

    /**
     * 信号の強度を取得（ノイズを減衰させた有効な強度）
     * @returns 信号強度 (0 ~ 255)
     */
    static getStrength(): number {
        if (!this.#analyser) throw new Error("AudioReceiver.initを実行する必要があります");
    
        this.#analyser.getByteFrequencyData(this.#dataArray);
        
        // 1. ターゲット帯域の強度（前後1ビンを含めた平均）
        const targetStrength = (
            (this.#dataArray[this.#targetBinIndex - 1] || 0) + 
            (this.#dataArray[this.#targetBinIndex] || 0) + 
            (this.#dataArray[this.#targetBinIndex + 1] || 0)
        ) / 3;

        // 2. リファレンス帯域の強度（環境ノイズ・広帯域ノイズの指標）
        const refStrength = ((this.#dataArray[this.#refBinIndex - 1] || 0) + (this.#dataArray[this.#refBinIndex] || 0) + (this.#dataArray[this.#refBinIndex + 1] || 0)) / 3;

        // 3. 広帯域ノイズの減衰処理（ペナルティの適用）
        // リファレンス帯域の音量も大きい場合は、ターゲット帯域の音量もノイズ由来とみなして引く
        const effectiveStrength = targetStrength - (refStrength * this.#NOISE_PENALTY_WEIGHT);

        // 結果がマイナスにならないようにし、整数に丸める
        return Math.max(0, Math.round(effectiveStrength));
    }
}