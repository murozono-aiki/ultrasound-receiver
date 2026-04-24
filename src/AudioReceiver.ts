export class AudioReceiver {
    static #audioContext:AudioContext;
    static #analyser:AnalyserNode;
    static #dataArray:Uint8Array<ArrayBuffer>;
    static #binIndex:number;

    /**
     * マイクの使用許可を得て、聴音の準備をする
     * @param targetFreq 監視したい周波数（Hz）
     */
    static async init(targetFreq:number):Promise<boolean> {
        try {
            if (!this.#audioContext) {
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
                this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = this.#audioContext.createMediaStreamSource(stream);
                
                // 音声解析ノードの作成
                this.#analyser = this.#audioContext.createAnalyser();
                this.#analyser.fftSize = 2048; // 細かさの設定 (2のべき乗)
                this.#analyser.smoothingTimeConstant = 0.8; // 動きを滑らかにする
                source.connect(this.#analyser);

                // 周波数データの格納先を準備
                const bufferLength = this.#analyser.frequencyBinCount;
                this.#dataArray = new Uint8Array(bufferLength);
            }
            
            // サンプリングレートに基づいて、18kHzがどのインデックスにあるか計算
            // index = 周波数 / (サンプリングレート / FFTサイズ)
            const sampleRate = this.#audioContext.sampleRate;
            this.#binIndex = Math.round(targetFreq / (sampleRate / this.#analyser.fftSize));

            return true;
        } catch (err:any) {
            alert('マイクへのアクセスが拒否されたか、エラーが発生しました。\n' + err.message);
            return false;
        }
    }

    /**
     * 信号の強度を取得
     * @returns 信号強度
     */
    static getStrength():number {
        if (!this.#analyser) new Error("AudioReceiver.initを実行する必要があります");
    
        // 現在の周波数データを取得
        this.#analyser.getByteFrequencyData(this.#dataArray);
        
        // 全体の中での最大音量（ノイズフロア確認用）
        const maxInAll = Math.max(...this.#dataArray);

        console.info(this.#dataArray[this.#binIndex - 1], this.#dataArray[this.#binIndex], this.#dataArray[this.#binIndex + 1]);
        // ターゲット周波数とその前後の平均値を取る（誤差吸収のため）
        const strength = Math.round(((this.#dataArray[this.#binIndex - 1] || 0) + (this.#dataArray[this.#binIndex] || 0) + (this.#dataArray[this.#binIndex + 1] || 0)) / 3) || 0;

        return strength;
    }
}