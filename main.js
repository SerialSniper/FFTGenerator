const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const audioCtx = new(window.AudioContext || window.webkitAudioContext)();
const oscillator = audioCtx.createOscillator();
const gainNode = audioCtx.createGain();
// ctx.canvas.width  = window.innerWidth;
ctx.canvas.width  = 1024;
ctx.canvas.height = window.innerHeight * .8;
var selectedWave = 0;
var playing = false;
var firstPlay = true;

class Complex {
    r = 0;
    i = 0;

    constructor(r, i) {
        this.r = r;
        this.i = i;
    }

    clone() {
        return new Complex(this.r, this.i);
    }

    magnitude() {
        return Math.sqrt(this.r * this.r + this.i * this.i);
    }

    add(other) {
        this.r += other.r;
        this.i += other.i;
        return this;
    }

    sub(other) {
        this.r -= other.r;
        this.i -= other.i;
        return this;
    }

    mul(other) {
        let r = this.r * other.r - this.i * other.i;
        let i = this.r * other.i + this.i * other.r;
        this.r = r;
        this.i = i;
        return this;
    }

    toString() {
        return this.r + (this.i >= 0 ? " + " : " - ") + Math.abs(this.i) + "i";
    }
}

const width = canvas.clientWidth;
const height = canvas.clientHeight;
const startTime = new Date();
let shift = 0;
let buffer = [];

$(".wave-selector-button").on("click", function() {
    $(".wave-selector > div").each(function() {
        $(this).removeAttr("selected");
    });
    $(this).attr("selected", "true");
    selectedWave = $(this).index();

    if(selectedWave == 3)
        $("#duty").removeAttr("disabled");
    else
        $("#duty").attr("disabled", "");
});

$("#play").on("click", function() {
    if(firstPlay) {
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        firstPlay = false;
    }

    playing = !playing;

    if(playing) {
        oscillator.connect(gainNode);
        $(this).attr("selected", "");
    } else {
        oscillator.disconnect(gainNode);
        $(this).removeAttr("selected");
    }
});

setInterval(() => {
    drawSine();
    drawFFT(buffer);
});

function drawSine() {
    let freq = $("#freq").val();
    let amp = $("#amp").val() / 10;
    let offset = $("#offset").val() / 10;
    let duty = $("#duty").val() / 50 - 1;

    $("#freq").attr("val", freq);
    $("#amp").attr("val", amp);
    $("#offset").attr("val", offset);
    $("#duty").attr("val", $("#duty").val());

    switch(selectedWave) {
        case 0: oscillator.type = "sine"; break;
        case 1: oscillator.type = "triangle"; break;
        case 2: oscillator.type = "sawtooth"; break;
        case 3: oscillator.type = "square"; break;
    }

    oscillator.frequency.value = freq;
    gainNode.gain.value = amp / 10;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.strokeStyle = "#999";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for(let i = 0; i < width; i++) {
        switch(selectedWave) {
            case 0:
                buffer[i] = sine(i, width, freq, amp, shift, offset);
                break;

            case 1:
                buffer[i] = triangle(i, width, freq, amp, shift, offset);
                break;

            case 2:
                buffer[i] = sawtooth(i, width, freq, amp, shift, offset);
                break;
                
            case 3:
                buffer[i] = square(i, width, freq, amp, duty, shift, offset);
                break;
        }
        
        let x = i;
        let y = height / 2 + -100 * buffer[i];

        if(i == 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
    shift = (new Date() - startTime) / 1000 * freq * 2 * Math.PI;
}

function sine(x, period, freq, amp, shift, offset) {
    return Math.sin(x / period * freq * 2 * Math.PI + shift) * amp + offset;
}

function triangle(x, period, freq, amp, shift, offset) {
    return (2 * Math.abs(((freq * x / period * 2 * Math.PI + shift) / Math.PI + 3/2) % 2 - 1) - 1) * amp + offset;
}

function sawtooth(x, period, freq, amp, shift, offset) {
    return (((freq * x / period * 2 * Math.PI + shift) / Math.PI) % 2 - 1) * amp + offset;
}

function square(x, period, freq, amp, duty, shift, offset) {
    return Math.sign(Math.sin(x / period * freq * 2 * Math.PI + shift) + duty) * amp + offset;
}

function dft(list) {
    const barWidth = 10;
    let size = list.length;
    let outBuffer = [];

    for(let freq = 0; freq < width / barWidth; freq++) {
        let resultComplex = new Complex(0, 0);
        for(let n = 0; n < size; n++) {
            let exponent = -2 * Math.PI * freq * n / size;
            let vector = new Complex(Math.cos(exponent), Math.sin(exponent))
                .mul(new Complex(list[n], 0));
            resultComplex.add(vector);
        }
        outBuffer[freq] = resultComplex.magnitude();
        let barHeight = outBuffer[freq] / 10 + 1;

        ctx.fillStyle = "#999";
        ctx.fillRect((width / size + barWidth) * freq, height - barHeight, barWidth, barHeight);
        console.log(freq + " " + outBuffer[freq]);
    }
    console.log("\n\n\n\n\n");
}

function drawFFT(list) {
    var before = new Date();
    let result = fft(list);
    $("#time").text(`FFT executed in ${new Date() - before}ms`);

    const barWidth = 1;
    for(let freq = 0; freq < list.length; freq++) {
        let barHeight = result[freq].magnitude() / 10 + 1;
        ctx.fillStyle = "#999";
        ctx.fillRect((width / list.length + barWidth) * freq, height - barHeight, barWidth, barHeight);
    }
}

function fft(list) {
    let size = list.length;
    let outBuffer = [];

    if(size == 1) {
        let complexList = [];
        for(let i = 0; i < size; i++)
            complexList[i] = new Complex(list[i], 0);
        return complexList;
    }

    let evens = [];
    let odds = [];
    for(let i = 0; i < size; i++) {
        if(i % 2 == 0)
            evens.push(list[i]);
        else
            odds.push(list[i]);
    }

    let evensOut = fft(evens);
    let oddsOut = fft(odds);
    const exponent = -2 * Math.PI / size;
    
    for(let freq = 0; freq < size / 2; freq++) {
        let exp = exponent * freq;
        let even = evensOut[freq];
        let odd = new Complex(Math.cos(exp), Math.sin(exp)).mul(oddsOut[freq]);
        outBuffer[freq] = even.clone().add(odd);
        outBuffer[freq + size / 2] = even.clone().sub(odd);
    }

    return outBuffer;
}