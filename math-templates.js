// math-templates.js — shared maths item templates (browser + builder).
// Pure functions of the RNG, so each call yields a fresh question.

function gcdOf(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }
function lcmOf(a, b) { return a / gcdOf(a, b) * b; }
function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
function divisorCount(n) { let c = 0; for (let i = 1; i * i <= n; i++) { if (n % i === 0) { c += (i * i === n) ? 1 : 2; } } return c; }
function shuffleWithRnd(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildMath(push, nid) {
    for (let g = 2; g <= 10; g++) {
        const low = g <= 3; // target grade 2-3 => 國小一、二年級 => needs 注音

        // ---- 是非題 (tf) : 8 basic / 3 pro / 1 challenge = 12
        for (let k = 0; k < 8; k++) {
            push('math', g, 'tf', {
                id: nid('math', g, 'tf'), diff: 'basic', tpl: true,
                gen: (rnd) => {
                    const a = g * 7 + k * 3 + 2 + Math.floor(rnd() * 9);
                    const b = g * 5 + k * 2 + 1 + Math.floor(rnd() * 9);
                    const wrong = rnd() < 0.5;
                    const shown = wrong ? a + b + 1 + Math.floor(rnd() * 3) : a + b;
                    return {
                        q: '判斷算式是否正確：' + a + ' + ' + b + ' = ' + shown,
                        options: ['是', '非'],
                        answer: [wrong ? 1 : 0],
                        explain: wrong
                            ? '不正確。' + a + ' + ' + b + ' 應為 ' + (a + b) + '，題目寫成 ' + shown + '。'
                            : '正確。' + a + ' + ' + b + ' = ' + (a + b) + '。'
                    };
                }
            });
        }
        for (let k = 0; k < 3; k++) {
            push('math', g, 'tf', {
                id: nid('math', g, 'tf'), diff: 'pro', tpl: true,
                gen: (rnd) => {
                    const n = g * 11 + k * 6 + Math.floor(rnd() * 12);
                    const ok = rnd() < 0.5;
                    return {
                        q: '判斷敘述是否正確：「' + n + ' 是 ' + n + ' 的因數，也是 ' + n + ' 的倍數。」',
                        options: ['是', '非'],
                        answer: [ok ? 0 : 1],
                        explain: ok
                            ? '正確。任何非零整數都是自己的因數，也是自己的倍數。'
                            : '錯誤。任何非零整數都是自己的因數與倍數。'
                    };
                }
            });
        }
        push('math', g, 'tf', {
            id: nid('math', g, 'tf'), diff: 'challenge', tpl: true,
            gen: () => ({
                q: '判斷敘述是否正確：「若 a 是偶數且 b 是奇數，則 a × b 一定是偶數。」',
                options: ['是', '非'],
                answer: [0],
                explain: '正確。偶數 × 任何整數 = 偶數，因為偶數含有因數 2。'
            })
        });

        // ---- 單選題 (single) : 8 basic / 3 pro / 1 challenge = 12
        for (let k = 0; k < 8; k++) {
            push('math', g, 'single', {
                id: nid('math', g, 'single'), diff: 'basic', tpl: true,
                gen: (rnd) => {
                    const side = g * 3 + k * 2 + 2 + Math.floor(rnd() * 7);
                    const peri = side * 4;
                    const correct = (side * side) + ' 平方公分';
                    const distract = [
                        (side * 4) + ' 平方公分',
                        (side * 2) + ' 平方公分',
                        (side + 4) + ' 平方公分'
                    ];
                    const all = shuffleWithRnd([correct, ...distract], rnd);
                    return {
                        q: '已知正方形的周長為 ' + peri + ' 公分，請問它的面積是多少平方公分？',
                        options: all,
                        answer: [all.indexOf(correct)],
                        explain: '邊長 = 周長 ÷ 4 = ' + peri + ' ÷ 4 = ' + side + ' 公分；面積 = ' + side + ' × ' + side + ' = ' + (side * side) + ' 平方公分。'
                    };
                }
            });
        }
        for (let k = 0; k < 3; k++) {
            push('math', g, 'single', {
                id: nid('math', g, 'single'), diff: 'pro', tpl: true,
                gen: (rnd) => {
                    const a = g * 4 + k * 3 + 1 + Math.floor(rnd() * 6);
                    const b = g * 2 + k + 1 + Math.floor(rnd() * 5);
                    const lcm = lcmOf(a, b);
                    const correct = String(lcm);
                    let distract = [String(a * b), String(gcdOf(a, b)), String(Math.round(a * b / 2))];
                    distract = distract.filter(d => d !== correct);
                    while (distract.length < 3) distract.push(String(lcm + distract.length + 1));
                    const all = shuffleWithRnd([correct, ...distract.slice(0, 3)], rnd);
                    return {
                        q: a + ' 和 ' + b + ' 的最小公倍數是多少？',
                        options: all,
                        answer: [all.indexOf(correct)],
                        explain: a + ' 和 ' + b + ' 的最小公倍數為 ' + lcm + '。'
                    };
                }
            });
        }
        push('math', g, 'single', {
            id: nid('math', g, 'single'), diff: 'challenge', tpl: true,
            gen: (rnd) => {
                const d = g + Math.floor(rnd() * 4);
                const width = d + 3;
                const peri = 4 * d + 12;
                const correct = width + ' 公分';
                const distract = [(d + 1) + ' 公分', (d + 5) + ' 公分', (d + 7) + ' 公分'];
                const all = shuffleWithRnd([correct, ...distract], rnd);
                return {
                    q: '一個長方形的長比寬多 ' + d + ' 公分，周長是 ' + peri + ' 公分。請問它的寬是多少公分？',
                    options: all,
                    answer: [all.indexOf(correct)],
                    explain: '設寬為 x，長為 x + ' + d + '。2(x + x + ' + d + ') = ' + peri + '，得 4x = ' + (peri - 2 * d) + '，x = ' + width + ' 公分。'
                };
            }
        });

        // ---- 多選題 (multiple) : 6 basic / 3 pro / 3 challenge = 12
        for (let k = 0; k < 6; k++) {
            push('math', g, 'multiple', {
                id: nid('math', g, 'multiple'), diff: 'basic', tpl: true,
                gen: (rnd) => {
                    const n = g * 6 + k * 4 + 3 + Math.floor(rnd() * 8);
                    const isEven = n % 2 === 0;
                    const opts = [
                        n + ' 是 ' + (isEven ? '偶數' : '奇數'),
                        n + ' 大於 ' + (n - 5),
                        '1 是 ' + n + ' 的因數',
                        n + ' 是負數'
                    ];
                    const correctTexts = opts.slice(0, 3);
                    const order = shuffleWithRnd(opts.map((t, i) => i), rnd);
                    const shuffled = order.map(i => opts[i]);
                    return {
                        q: '關於整數 ' + n + '，下列哪些敘述是正確的？（可多選）',
                        options: shuffled,
                        answer: correctTexts.map(t => shuffled.indexOf(t)).sort((a, b) => a - b),
                        explain: n + ' 為' + (isEven ? '偶數' : '奇數') + '、大於 ' + (n - 5) + '，且 1 是任何整數的因數；' + n + ' 是正數，故「是負數」錯誤。'
                    };
                }
            });
        }
        for (let k = 0; k < 3; k++) {
            push('math', g, 'multiple', {
                id: nid('math', g, 'multiple'), diff: 'pro', tpl: true,
                gen: (rnd) => {
                    const a = g + k + 2 + Math.floor(rnd() * 6);
                    const target = a * 2;
                    const opts = [a + ' × 2', String(a + a), (a * 4) + ' ÷ 2', target + ' + 1'];
                    const correctTexts = opts.slice(0, 3);
                    const order = shuffleWithRnd(opts.map((t, i) => i), rnd);
                    const shuffled = order.map(i => opts[i]);
                    return {
                        q: '下列哪些運算結果等於 ' + target + '？（可多選）',
                        options: shuffled,
                        answer: correctTexts.map(t => shuffled.indexOf(t)).sort((a, b) => a - b),
                        explain: a + ' × 2 = ' + target + '；' + a + ' + ' + a + ' = ' + target + '；' + (a * 4) + ' ÷ 2 = ' + target + '；最後一項為 ' + (target + 1) + '，不相等。'
                    };
                }
            });
        }
        for (let k = 0; k < 3; k++) {
            push('math', g, 'multiple', {
                id: nid('math', g, 'multiple'), diff: 'challenge', tpl: true,
                gen: (rnd) => {
                    const n = g * 3 + k * 2 + 4 + Math.floor(rnd() * 10);
                    const dc = divisorCount(n);
                    const opts = [
                        isPrime(n) ? (n + ' 是質數') : (n + ' 不是質數'),
                        n + ' 的因數個數為 ' + dc + ' 個',
                        n + ' 與 ' + (n + 1) + ' 互質',
                        n + ' 必為 3 的倍數'
                    ];
                    // The first three are true by construction; the fourth is
                    // true only when n is actually divisible by 3.
                    const answer = [0, 1, 2];
                    if (n % 3 === 0) answer.push(3);
                    return {
                        q: '設 n = ' + n + '。下列哪些關於 n 的敘述是正確的？（可多選）',
                        options: opts,
                        answer: answer,
                        explain: 'n = ' + n + '，因數個數為 ' + dc + '；連續兩整數必互質。' + (n % 3 === 0 ? 'n 是 3 的倍數。' : 'n 不是 3 的倍數，故最後一項錯誤。')
                    };
                }
            });
        }
    }
}


// Browser: expose a global so item-bank.js can rebuild the generators.
if (typeof window !== 'undefined') {
    window.mathTemplates = { buildMath, gcdOf, lcmOf, isPrime, divisorCount, shuffleWithRnd };
}
// Node (build script): CommonJS export.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildMath, gcdOf, lcmOf, isPrime, divisorCount, shuffleWithRnd };
}
