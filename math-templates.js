// math-templates.js — shared maths item templates (browser + builder).
// Pure functions of the RNG, so each call yields a fresh question.
//
// ---------------------------------------------------------------------------
// 課綱依據：108 年十二年國教課程綱要・數學領域學習重點
//   https://cirn.k12ea.gov.tw/TWELLE/List.aspx?fid=11164
//   （正確連結： https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11164）
//
// 每個題組(template family)帶三個欄位：
//   scope : 該題組最早可出現在哪個「目標年級」(targetGrade 現年級+1、檢測升X年級)
//           課綱學習階段：S1=國小1-2年級→0、S2=3-4年級→4、S3=5-6年級→6、S4=國中7-9年級→8
//   fam   : 模板族鍵；同一張試卷同族最多 2 題（drawItems 的簽名上限，index.html）
//   src   : 課綱條目代碼（稽核出處用）
// 抽題時 drawItems 先以 scope 過濾題庫，再以 SCOPE_KEYWORDS 關鍵字防護網
// 過濾已物化題面，確保低年級考卷不會流出超綱題。
// ---------------------------------------------------------------------------

const MATH_SRC = 'https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11164';

// 關鍵字防護網：字詞 → 最早允許的目標年級。
// 6 = S3 起（國小 5-6 年級，課綱 n-III-3 因數倍數質數 / n-III-9 比例關係）
// 8 = S4 起（國中，課綱 n-IV-2 負數 / n-IV-3 指數律與科學記號 / n-IV-5 根號 / n-IV-7 數列）
const SCOPE_KEYWORDS = {
    '因數': 6, '因數、倍數': 6, '倍數': 6, '公因數': 6, '公倍數': 6, '互質': 6, '質數': 6,
    '合數': 6, '整除': 6, '最小公倍數': 6, '最大公因數': 6, '質因數': 6, '質因數分解': 6,
    '比例尺': 6, '正比': 6, '反比': 6, '比率': 6, '連比': 6, '比例式': 6, '基準量': 6, '速度': 6,
    '負數': 8, '指數律': 8, '科學記號': 8, '平方根': 8, '根號': 8, '二次方根': 8,
    '等差數列': 8, '等比數列': 8, '等差級數': 8, '數線': 4
};

// 讓 SCOPE_KEYWORDS 可直接繫結到 index.html 的作用域（同域命名，無衝突）。
const scopeViolation = (text, targetGrade) => {
    for (const kw in SCOPE_KEYWORDS) {
        if (targetGrade < SCOPE_KEYWORDS[kw] && text.indexOf(kw) >= 0) return true;
    }
    return false;
};

function gcdOf(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }
function lcmOf(a, b) { return a / gcdOf(a, b) * b; }
function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
function divisorCount(n) { let c = 0; for (let i = 1; i * i <= n; i++) { if (n % i === 0) { c += (i * i === n) ? 1 : 2; } } return c; }
function shuffleWithRnd(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function bf(tpl, pair) { return (typeof tpl === 'function' ? tpl(pair) : tpl).replace('#a', String(pair[0])).replace('#b', String(pair[1])); }

function buildMath(push, nid) {
    // 家族註冊器：把題組註冊到「所有目標年級 >= from」的題庫（年級範圍白名單）。
    // 題面由 rnd 隨機生成；scope=from 儲存在題目上，drawItems 抽題時會再檢查。
    const fam = (from, type, diff, scope, src, count, gen) => {
        for (let g = from; g <= 10; g++) {
            for (let k = 0; k < count; k++) {
                push('math', g, type, { id: nid('math', g, type), diff, tpl: true, scope: from, fam: gen.fam, src, gen });
            }
        }
    };

    // ---------------- 是非題 tf ----------------
    // S1 加減法算式判斷
    ['tf.add', 'tf.sub'].forEach(fid => {
        const gen = (rnd) => {
            const add = fid === 'tf.add';
            const a = 6 + Math.floor(rnd() * 40), b = 3 + Math.floor(rnd() * 25);
            const right = add ? a + b : a - b;
            const wrong = rnd() < 0.5;
            const shown = wrong ? right + 1 + Math.floor(rnd() * 4) : right;
            return {
                q: '判斷算式是否正確：' + a + (add ? ' + ' : ' − ') + b + ' = ' + shown,
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。' + a + (add ? ' + ' : ' − ') + b + ' 應為 ' + right + '，題目寫成 ' + shown + '。'
                    : '正確。' + a + (add ? ' + ' : ' − ') + b + ' = ' + right + '。'
            };
        };
        gen.fam = fid;
        fid === 'tf.add'
            ? fam(2, 'tf', 'basic', 0, 'n-I-2', 4, gen)
            : fam(2, 'tf', 'basic', 0, 'n-I-2', 4, gen);
    });
    // S1 乘除法算式判斷
    ['tf.mul', 'tf.div'].forEach(fid => {
        const gen = (rnd) => {
            const mul = fid === 'tf.mul';
            const a = 3 + Math.floor(rnd() * 9), b = 3 + Math.floor(rnd() * 9);
            const right = mul ? a * b : (4 + Math.floor(rnd() * 9)) * b; // 除法取整除情形
            const divisor = mul ? b : b;
            const dividend = mul ? a : Math.floor(right);
            const wrong = rnd() < 0.5;
            const shown = wrong ? right + 1 + Math.floor(rnd() * 3) : right;
            return {
                q: '判斷算式是否正確：' + dividend + (mul ? ' × ' : ' ÷ ') + divisor + ' = ' + shown,
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。' + dividend + (mul ? ' × ' : ' ÷ ') + divisor + ' 應為 ' + right + '，題目寫成 ' + shown + '。'
                    : '正確。' + dividend + (mul ? ' × ' : ' ÷ ') + divisor + ' = ' + right + '。'
            };
        };
        gen.fam = fid;
        fam(2, 'tf', 'basic', 0, mul_src(fid), 4, gen);
    });
    // S1 加減法比較大小
    {
        const gen = (rnd) => {
            const a = 8 + Math.floor(rnd() * 40), left = 4 + Math.floor(rnd() * 20), right = 4 + Math.floor(rnd() * 20);
            const flip = rnd() < 0.5;
            const L = flip ? right : left, R = flip ? left : right;
            return {
                q: '判斷是否正確：' + a + ' + ' + L + ' ＞ ' + a + ' + ' + R,
                options: ['是', '非'], answer: [L > R ? 0 : 1],
                explain: '兩式同加 ' + a + '，只要比 ' + L + ' 與 ' + R + ' 的大小即可：' + L + (L > R ? ' ＞ ' : L < R ? ' ＜ ' : ' ＝ ') + R + '。'
            };
        };
        gen.fam = 'tf.cmp';
        fam(2, 'tf', 'pro', 0, 'n-I-3', 3, gen);
    }
    // S1 時刻與時間單位
    {
        const gen = () => ({
            q: '判斷是否正確：「時鐘的短針是時針，長針是分針；分針走一大格是 5 分鐘。」',
            options: ['是', '非'], answer: [0],
            explain: '正確。短針為時針、長針為分針，分針每大格代表 5 分鐘。'
        });
        gen.fam = 'tf.time';
        fam(2, 'tf', 'challenge', 0, 'n-I-9', 3, gen);
    }
    // S1 分數（單位分數與同分母比較）
    ['tf.frac', 'tf.frac2'].forEach((fid, i) => {
        const gen = (rnd) => {
            const d = 4 + Math.floor(rnd() * 6);
            const n1 = i === 0 ? 1 : (1 + Math.floor(rnd() * (d - 1)));
            const n2 = i === 0 ? (n1 + 1) : (n1 === d - 1 ? n1 - 1 : n1 + 1);
            const sm = n1 < n2;
            const stated = sm; // 敘述固定為「前者是否較小」；當敘述為真答案應為「是」
            return {
                q: '分數比較：' + n1 + ' / ' + d + ' 與 ' + n2 + ' / ' + d + '，「前者較小」是否正確？',
                options: ['是', '非'], answer: [stated ? 0 : 1],
                explain: '分母相同比分子：' + n1 + ' / ' + d + (sm ? ' ＜ ' : ' ＞ ') + n2 + ' / ' + d + '，故「前者較小」' + (sm ? '正確。' : '不正確。')
            };
        };
        gen.fam = fid;
        fam(2, 'tf', 'basic', 0, i === 0 ? 'n-I-6' : 'n-II-6', 3, gen);
    });
    // S1 整數奇偶性
    {
        const gen = (rnd) => {
            const n = 11 + Math.floor(rnd() * 60);
            return {
                q: '判斷是否正確：' + n + ' 是' + (n % 2 === 0 ? '偶數。' : '奇數。'),
                options: ['是', '非'], answer: [0],
                explain: n + ' 除以 2 ' + (n % 2 === 0 ? '餘 0，是偶數。' : '餘 1，是奇數。')
            };
        };
        gen.fam = 'tf.even';
        fam(4, 'tf', 'pro', 0, 'n-II-8', 3, gen);
    }
    // S1 位數與位值
    {
        const gen = (rnd) => {
            const n = 100 + Math.floor(rnd() * 9000);
            const digits = String(n).length;
            const wrong = rnd() < 0.5;
            const claimed = wrong ? digits + 1 + Math.floor(rnd() * 2) : digits;
            return {
                q: '判斷是否正確：數字 ' + n + ' 是「' + claimed + ' 位數」。',
                options: ['是', '非'], answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。' + n + ' 共佔 ' + digits + ' 個位數，不是 ' + claimed + ' 位。'
                    : '正確。' + n + ' 共佔 ' + digits + ' 個位數。'
            };
        };
        gen.fam = 'tf.digits';
        fam(2, 'tf', 'basic', 0, 'n-I-1', 4, gen);
    }
    // S2 單位換算（正誤各半，保持題庫是/非平衡）
    {
        const gen = (rnd) => {
            const rows = [
                ['1 公尺 = 100 公分', 0, '長度換算：1 公尺 = 100 公分。'],
                ['1 公斤 = 1000 公克', 0, '重量換算：1 公斤 = 1000 公克。'],
                ['1 升 = 1000 毫升', 0, '容量換算：1 升 = 1000 毫升。'],
                ['1 小時 = 100 分鐘', 1, '時間換算：1 小時 = 60 分鐘，不是 100 分鐘。'],
                ['1 分鐘 = 10 秒', 1, '時間換算：1 分鐘 = 60 秒，不是 10 秒。']
            ];
            const r = rows[Math.floor(rnd() * rows.length)];
            return {
                q: '判斷換算是否正確：「' + r[0] + '」', options: ['是', '非'], answer: [r[1]],
                explain: (r[1] === 0 ? '正確。' : '錯誤。') + r[2]
            };
        };
        gen.fam = 'tf.unit';
        fam(2, 'tf', 'basic', 0, 'n-II-9', 4, gen);
    }
    // S1 估算與推理（pro，from 2：供低年級 pro 配額）
    {
        const gen = (rnd) => {
            const a = 10 + Math.floor(rnd() * 60), b = 3 + Math.floor(rnd() * 40);
            const approx = Math.round((a + b) / 10) * 10;
            const ok = rnd() < 0.5;
            const claimed = ok ? approx : approx + 10;
            return {
                q: '估算：' + a + ' + ' + b + ' 大約是 ' + claimed + '（四捨五入到十位）？',
                options: ['是', '非'], answer: [ok ? 0 : 1],
                explain: (ok ? '正確。' : '錯誤。') + a + ' + ' + b + ' = ' + (a + b) + '，四捨五入到十位是 ' + approx + '，' + (ok ? '与題敘一致。' : '題敘寫成 ' + claimed + '。').replace('与', '與')
            };
        };
        gen.fam = 'tf.est';
        fam(2, 'tf', 'pro', 0, 'n-I-3', 3, gen);
    }
    // S3 因數與倍數（課綱 n-III-3，目標年級>=6 才入庫；題面動態、非退化敘述）
    ['tf.fac_even', 'tf.fac_parity', 'tf.fac_div'].forEach((fid, i) => {
        const gen = (rnd) => {
            const n = 6 + Math.floor(rnd() * 40);
            let claim, ok, why;
            if (i === 0) {
                const even = Math.floor(rnd() * 2) === 0;
                const num = even ? (n - (n % 2)) : (n + (n % 2 === 0 ? 0 : 1));
                claim = '偶數 ' + num + ' 一定是 2 的倍數';
                ok = true;
                why = '偶數除以 2 餘 0，' + num + ' 是 2 的倍數。';
            } else if (i === 1) {
                const flip = rnd() < 0.5;
                const target = flip && n % 3 !== 0 ? n : (n % 3 === 0 ? n : n - (n % 3));
                claim = target + ' 是 3 的倍數';
                ok = (target % 3 === 0);
                why = '各位數和 ' + String(target).split('').reduce((s, c) => s + +c, 0) + (ok ? ' 是 3 的倍數，故成立。' : ' 不是 3 的倍數，故不成立。');
            } else {
                const b = 2 + Math.floor(rnd() * 9);
                const rem = rnd() < 0.5 ? 0 : 1;
                const ab = b * (3 + Math.floor(rnd() * 9)) + rem;
                claim = ab + ' ÷ ' + b + ' 能整除（無餘數）';
                ok = (ab % b === 0);
                why = ab + ' ÷ ' + b + ' = ' + Math.floor(ab / b) + (ab % b === 0 ? '，可整除。' : ' …… 餘 ' + (ab % b) + '，不能整除。');
            }
            return {
                q: '判斷是否正確：「' + claim + '」', options: ['是', '非'], answer: [ok ? 0 : 1],
                explain: (ok ? '正確。' : '錯誤。') + why
            };
        };
        gen.fam = fid;
        fam(6, 'tf', 'pro', 0, 'n-III-3', 3, gen);
    });
    // S4 整數與負數（課綱 n-IV-2，目標年級>=8 才入庫；正誤動態平衡）
    ['tf.neg_sum', 'tf.neg_cmp', 'tf.neg_abs'].forEach((fid, i) => {
        const gen = (rnd) => {
            const a = 1 + Math.floor(rnd() * 30), b = 1 + Math.floor(rnd() * 30);
            if (i === 0) {
                const wrong = rnd() < 0.5;
                const right = -(a + b);
                const shown = wrong ? (right + 1 + Math.floor(rnd() * 4)) : right;
                const claim = '-' + a + ' + (-' + b + ') = ' + shown;
                return {
                    q: '判斷算式是否正確：「' + claim + '」', options: ['是', '非'], answer: [wrong ? 1 : 0],
                    explain: wrong
                        ? '不正確。-( ' + a + ' + ' + b + ' ) = ' + right + '，題目寫成 ' + shown + '。'
                        : '正確。-' + a + ' + (-' + b + ') = -' + (a + b) + '。'
                };
            }
            if (i === 1) {
                const L = -a, R = -b, truth = L > R;
                const flipped = rnd() < 0.5;
                const stated = flipped ? !truth : truth;
                return {
                    q: '判斷是否正確：「' + L + ' ＞ ' + R + '」', options: ['是', '非'], answer: [stated ? 0 : 1],
                    explain: '數線上 ' + L + ' ' + (truth ? '在 ' + R + ' 右側，前者較大。' : '在 ' + R + ' 左側，前者較小。') + (flipped ? '本題敘述與事實相反。' : '')
                };
            }
            const wrong = rnd() < 0.5;
            const right = a;
            const shown = wrong ? (a + 1) : a;
            return {
                q: '判斷是否正確：「|-' + a + '| = ' + shown + '」', options: ['是', '非'], answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。-' + a + ' 距原點 ' + a + ' 格，絕對值為 ' + right + '，題目寫成 ' + shown + '。'
                    : '正確。-' + a + ' 的絕對值是 ' + right + '。'
            };
        };
        gen.fam = fid;
        fam(8, 'tf', 'pro', 0, 'n-IV-2', 3, gen);
    });
    // ---------------- 單選題 single ----------------
    // S1 兩步驟生活應用
    {
        const gen = (rnd) => {
            const base = 8 + Math.floor(rnd() * 30), lost = 2 + Math.floor(rnd() * 6);
            const correct = String(base + lost * 2);
            const distract = [String(base - lost), String(base + lost), String(base + lost * 3)];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '袋子裡有 ' + base + ' 顆彈珠，小明放進 ' + lost + ' 顆後又放進 ' + lost + ' 顆，現在共有幾顆？',
                options: all, answer: [all.indexOf(correct)],
                explain: base + ' + ' + lost + ' + ' + lost + ' = ' + (base + lost * 2) + ' 顆。'
            };
        };
        gen.fam = 'sp.word';
        fam(2, 'single', 'basic', 0, 'n-I-5', 3, gen);
    }
    // S1 正方形周長與面積
    {
        const gen = (rnd) => {
            const side = 3 + Math.floor(rnd() * 12), peri = side * 4;
            const correct = (side * side) + ' 平方公分';
            const distract = [peri + ' 平方公分', (side * 2) + ' 平方公分', (side + 4) + ' 平方公分'];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '已知正方形的周長為 ' + peri + ' 公分，請問它的面積是多少平方公分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '邊長 = 周長 ÷ 4 = ' + side + ' 公分；面積 = ' + side + ' × ' + side + ' = ' + (side * side) + ' 平方公分。'
            };
        };
        gen.fam = 'sp.sq';
        fam(2, 'single', 'pro', 0, 'n-I-8', 4, gen);
    }
    // S1 長方形周長應用
    {
        const gen = (rnd) => {
            const d = 2 + Math.floor(rnd() * 6), width = d + 3, peri = 4 * d + 12;
            const distr = [(d + 1) + ' 公分', (d + 5) + ' 公分', (d + 7) + ' 公分'];
            const correct = width + ' 公分';
            const all = shuffleWithRnd([correct, ...distr], rnd);
            return {
                q: '一個長方形的長比寬多 ' + d + ' 公分，周長是 ' + peri + ' 公分。請問它的寬是多少公分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '設寬 x、長 x + ' + d + '，2(2x + ' + d + ') = ' + peri + '，解得 x = ' + width + ' 公分。'
            };
        };
        gen.fam = 'sp.rect';
        fam(4, 'single', 'challenge', 0, 'n-II-9', 2, gen);
    }
    // S1 時刻判讀
    {
        const gen = (rnd) => {
            const h = 1 + Math.floor(rnd() * 12), m = [0, 15, 30, 45][Math.floor(rnd() * 4)];
            const correct = h + ' 點 ' + (m === 0 ? '整' : m + ' 分');
            const otherH = (h % 12) + 1;
            const distract = [otherH + ' 點 ' + (m === 0 ? '整' : m + ' 分'), h + ' 點 ' + ((m + 30) % 60) + ' 分', h + ' 點 5 分'];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '時鐘的短針指在 ' + h + ' 附近、長針指在 ' + (m / 5) + '，此時大約是幾點幾分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '長針每大格 5 分鐘，指向第 ' + (m / 5) + ' 格即 ' + m + ' 分，短針在 ' + h + ' 點附近：' + correct + '。'
            };
        };
        gen.fam = 'sp.clock';
        fam(2, 'single', 'challenge', 0, 'n-I-9', 3, gen);
    }
    // S1 分數概念
    {
        const gen = (rnd) => {
            const d = 4 + Math.floor(rnd() * 5); // 分母 4-8
            const correct = '全部的 1 個 ' + d + ' 分之 1（即 ' + d + ' 分之一）';
            const distract = ['全部的 1', '全部的 ' + d, '全部的狀態'];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '把一個披薩平分成 ' + d + ' 片、只吃其中 1 片，吃掉的部分是「全部的」多少？',
                options: all, answer: [all.indexOf(correct)],
                explain: '平分 ' + d + ' 份取其一，即 ' + d + ' 分之 1。'
            };
        };
        gen.fam = 'sp.frac1';
        fam(2, 'single', 'basic', 0, 'n-I-6', 3, gen);
    }
    // S1 面積概念
    {
        const gen = (rnd) => {
            const l = 3 + Math.floor(rnd() * 10), w = 2 + Math.floor(rnd() * 8);
            const correct = (l * w) + ' 平方公分';
            const distract = [(2 * (l + w)) + ' 平方公分', (l + w) + ' 平方公分', (l * w * 4) + ' 平方公分'];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '一張長 ' + l + ' 公分、寬 ' + w + ' 公分的長方形紙板，面積是多少平方公分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '長方形面積 = 長 × 寬 = ' + l + ' × ' + w + ' = ' + (l * w) + ' 平方公分。'
            };
        };
        gen.fam = 'sp.area';
        fam(4, 'single', 'pro', 0, 'n-II-9', 3, gen);
    }
    // S3 因數與倍數（n-III-3，目標年級>=6）
    {
        const gen = (rnd) => {
            const a = 4 + Math.floor(rnd() * 12), b = 4 + Math.floor(rnd() * 12);
            const lcm = lcmOf(a, b);
            let distract = [String(a * b), String(gcdOf(a, b)), String(Math.round(a * b / 2))];
            distract = distract.filter(d => d !== String(lcm));
            while (distract.length < 3) distract.push(String(lcm + distract.length + 1));
            const all = shuffleWithRnd([String(lcm), ...distract.slice(0, 3)], rnd);
            return {
                q: a + ' 和 ' + b + ' 的最小公倍數是多少？',
                options: all, answer: [all.indexOf(String(lcm))],
                explain: a + ' 和 ' + b + ' 的最小公倍數為 ' + lcm + '。'
            };
        };
        gen.fam = 'sp.lcm';
        fam(6, 'single', 'pro', 0, 'n-III-3', 4, gen);
    }
    {
        const gen = (rnd) => {
            const a = 4 + Math.floor(rnd() * 16), b = 4 + Math.floor(rnd() * 16);
            const g = gcdOf(a, b);
            let distract = [String(lcmOf(a, b)), String(a * b), String(g + 1)];
            distract = distract.filter(d => d !== String(g));
            while (distract.length < 3) distract.push(String(g + distract.length + 1));
            const all = shuffleWithRnd([String(g), ...distract.slice(0, 3)], rnd);
            return {
                q: a + ' 和 ' + b + ' 的最大公因數是多少？',
                options: all, answer: [all.indexOf(String(g))],
                explain: a + ' 和 ' + b + ' 的最大公因數為 ' + g + '。'
            };
        };
        gen.fam = 'sp.gcd';
        fam(6, 'single', 'pro', 0, 'n-III-3', 4, gen);
    }
    // S3 比例關係（n-III-9，目標年級>=6）
    {
        const gen = (rnd) => {
            const k = 2 + Math.floor(rnd() * 5), n = 3 + Math.floor(rnd() * 7);
            const correct = String(k * n);
            const distract = [String(k + n), String(k * n + 1)];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '地圖比例尺 1 : ' + k + '，圖上 ' + n + ' 公分代表實際幾公分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '實際距離 = 圖上 × ' + k + ' = ' + n + ' × ' + k + ' = ' + (k * n) + ' 公分。'
            };
        };
        gen.fam = 'sp.scale';
        fam(6, 'single', 'pro', 0, 'n-III-9', 3, gen);
    }
    // S4 負數四則（n-IV-2，目標年級>=8）
    {
        const gen = (rnd) => {
            const a = -(1 + Math.floor(rnd() * 30)), b = -(1 + Math.floor(rnd() * 30));
            const correct = String(a + b);
            const distract = [String(a - b), String(Math.abs(a) + Math.abs(b)), String(Math.abs(a + b))];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: a + ' + ' + b + ' = ?', options: all, answer: [all.indexOf(correct)],
                explain: '兩負數相加取負號再相加絕對值：-( ' + Math.abs(a) + ' + ' + Math.abs(b) + ' ) = ' + correct + '。'
            };
        };
        gen.fam = 'sp.negadd';
        fam(8, 'single', 'basic', 0, 'n-IV-2', 4, gen);
    }
    // S4 指數與根式（n-IV-3 / n-IV-5，目標年級>=8）
    {
        const gen = (rnd) => {
            const n = 2 + Math.floor(rnd() * 8), e = 2 + Math.floor(rnd() * 3);
            const correct = String(Math.pow(n, e));
            const distract = [String(n * e), String(n * e + n), String(Math.pow(n, e - 1))];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '下列何者等於 ' + n + ' 的 ' + e + ' 次方（' + n + '^' + e + '）？',
                options: all, answer: [all.indexOf(correct)],
                explain: n + '^' + e + ' = ' + n + String(' × ' + n).repeat(e - 1) + ' = ' + correct + '。'
            };
        };
        gen.fam = 'sp.exp';
        fam(8, 'single', 'pro', 0, 'n-IV-3', 3, gen);
    }
    {
        const gen = (rnd) => {
            const n = [4, 9, 16, 25, 36, 49][Math.floor(rnd() * 6)];
            const correct = String(Math.sqrt(n));
            const distract = [String(Math.sqrt(n) + 1), String(n / 2), String(n / 4)];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '下列何者等於根號 ' + n + '（√' + n + '）？',
                options: all, answer: [all.indexOf(correct)],
                explain: '√' + n + ' = ' + correct + '，因為 ' + correct + ' × ' + correct + ' = ' + n + '。'
            };
        };
        gen.fam = 'sp.sqrt';
        fam(8, 'single', 'pro', 0, 'n-IV-5', 3, gen);
    }
    // ---------------- 多選題 multiple ----------------
    // S1 奇偶與整數性質
    {
        const gen = (rnd) => {
            const n = 6 + Math.floor(rnd() * 40);
            const isEven = n % 2 === 0;
            const opts = [n + ' 是 ' + (isEven ? '偶數' : '奇數'), n + ' 大於 ' + (n - 5), n + ' 比 ' + (n + 1) + ' 小', 'n 是最小的那個整數'];
            const correctTexts = opts.slice(0, 3);
            const order = shuffleWithRnd(opts.map((t, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於整數 ' + n + '，下列哪些敘述是正確的？（可多選）',
                options: shuffled,
                answer: correctTexts.map(t => shuffled.indexOf(t)).sort((a, b) => a - b),
                explain: n + ' 為' + (isEven ? '偶數' : '奇數') + '、大於 ' + (n - 5) + '、也比 ' + (n + 1) + ' 小；整數無最小者，末項錯誤。'
            };
        };
        gen.fam = 'ml.even';
        fam(4, 'multiple', 'basic', 0, 'n-II-8', 6, gen);
    }
    // S1 生活應用（兩步驟）
    {
        const gen = (rnd) => {
            const a = 3 + Math.floor(rnd() * 9), b = 3 + Math.floor(rnd() * 9);
            const opts = [a + ' × ' + b, String(a * b), String(a + b), String(a * b + 1)];
            const dup = String(a * b);
            const opts2 = [a + ' × ' + b, dup, a + ' + ' + b, String(a * b + 1)];
            const correctTexts = [opts2[0], opts2[1]];
            const order = shuffleWithRnd(opts2.map((t, i) => i), rnd);
            const shuffled = order.map(i => opts2[i]);
            return {
                q: '一盒有 ' + a + ' 顆蘋果，買 ' + b + ' 盒。下列哪些可求出總數？（可多選）',
                options: shuffled,
                answer: correctTexts.map(t => shuffled.indexOf(t)).sort((x, y) => x - y),
                explain: '總數 = 每盒 ' + a + ' × ' + b + ' 盒 = ' + a * b + '；「' + a + ' × ' + b + '」與「' + a * b + '」都正確，' + a + ' + ' + b + ' 與 ' + (a * b + 1) + ' 不是總數。'
            };
        };
        gen.fam = 'ml.story';
        fam(2, 'multiple', 'basic', 0, 'n-I-5', 6, gen);
    }
    // S1 算式比較（四則）
    {
        const gen = (rnd) => {
            const a = 5 + Math.floor(rnd() * 25), b = 3 + Math.floor(rnd() * 15);
            const opts = [a + ' + ' + b + ' 與 ' + (a + 1) + ' + ' + (b - 1) + ' 相等', String(a + b) + ' 是和', a + ' − ' + b + ' 是差', a + ' + ' + b + ' 等於 ' + (a * b)];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((t, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於算式 ' + a + ' + ' + b + '，下列哪些正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(t => shuffled.indexOf(t)).sort((x, y) => x - y),
                explain: '加法交換律 ' + a + ' + ' + b + ' = ' + (a + 1) + ' + ' + (b - 1) + ' = ' + (a + b) + '；和、差定義正確；' + a + ' + ' + b + ' = ' + (a + b) + ' ≠ ' + (a * b) + '，末項錯誤。'
            };
        };
        gen.fam = 'ml.arith';
        fam(2, 'multiple', 'pro', 0, 'n-I-2', 6, gen);
    }
    // S1 單位認識
    {
        const gen = () => {
            const opts = ['公分', '公尺', '公斤', '時鐘'];
            return {
                q: '下列哪些是「長度」的單位？（可多選）',
                options: opts, answer: [0, 1],
                explain: '公分、公尺是長度單位；公斤是重量，時鐘是計時工具不是單位。'
            };
        };
        gen.fam = 'ml.unit';
        fam(2, 'multiple', 'pro', 0, 'n-I-7', 6, gen);
    }
    // S1 形狀認識
    {
        const gen = () => {
            const opts = ['正方形四邊等長', '三角形有三邊', '圓有無數條對稱軸', '長方形鄰邊必定等長'];
            return {
                q: '下列哪些關於圖形的敘述正確？（可多選）',
                options: opts, answer: [0, 1, 2],
                explain: '前三項正確；長方形僅對邊相等，鄰邊一般不等，故第四項錯誤。'
            };
        };
        gen.fam = 'ml.shape';
        fam(2, 'multiple', 'basic', 0, 'n-I-8', 5, gen);
    }
    // S1 進位加減陷阱（challenge，from 2：供低年級 challenge 配額）
    {
        const gen = (rnd) => {
            const t = 10 + Math.floor(rnd() * 70), u = 1 + Math.floor(rnd() * 8);
            const sum = t + u, carry = (t % 10 + u) >= 10;
            const opts = [carry ? '個位相加滿十需進位' : '個位相加不滿十不進位', '和是 ' + sum, '和是 ' + (sum + 10), '個位相加結果是 ' + (t % 10 + u)];
            const answer = carry ? [0, 1, 3] : [1, 3];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於 ' + t + ' + ' + u + ' 的直式計算，下列哪些正確？（可多選）',
                options: shuffled,
                answer: answer.map(i => shuffled.indexOf(opts[i])).sort((x, y) => x - y),
                explain: '個位 ' + (t % 10) + ' + ' + u + ' = ' + (t % 10 + u) + (carry ? '（滿十進位）' : '（未滿十）') + '，總和為 ' + sum + '。'
            };
        };
        gen.fam = 'ml.regroup';
        fam(2, 'multiple', 'challenge', 0, 'n-I-2', 3, gen);
    }
    // S3 因數倍數（n-III-3，目標年級>=6）
    {
        const gen = (rnd) => {
            const n = 6 + Math.floor(rnd() * 40);
            const dc = divisorCount(n);
            const opts = [isPrime(n) ? (n + ' 是質數') : (n + ' 不是質數'), n + ' 的因數個數為 ' + dc + ' 個', n + ' 是 ' + n + ' 的因數', '0 是 ' + n + ' 的因數'];
            const answer = [0, 1, 2]; // 第 4 項「0 是 n 的因數」永假
            return {
                q: '設 n = ' + n + '。下列哪些關於 n 的敘述正確？（可多選）',
                options: opts, answer: answer,
                explain: 'n = ' + n + '，因數個數 ' + dc + '；任何非零整數都是自己的因數；0 不是任何整數的因數，末項錯誤。'
            };
        };
        gen.fam = 'ml.factor';
        fam(6, 'multiple', 'challenge', 0, 'n-III-3', 6, gen);
    }
    // S3 比例（n-III-9，目標年級>=6）
    {
        const gen = (rnd) => {
            const k = 2 + Math.floor(rnd() * 6);
            const opts = ['兩量成正比', '圖上 1 對應實際 ' + k, '加倍圖上長度實際也加倍', '比例尺與實際長度無關'];
            return {
                q: '比例尺 1 : ' + k + ' 的地图，下列哪些正確？（可多選）'.replace('地图', '地圖'),
                options: opts, answer: [0, 1, 2],
                explain: '比例尺固定時圖上與實際成正比，1 對應 ' + k + '，等比放大；第四項錯誤。'
            };
        };
        gen.fam = 'ml.scale';
        fam(6, 'multiple', 'pro', 0, 'n-III-9', 5, gen);
    }
    // S4 負數與數線（n-IV-2，目標年級>=8）
    {
        const gen = (rnd) => {
            const a = -(1 + Math.floor(rnd() * 20));
            const opts = ['選項一 ' + Math.abs(a) + ' 在 ' + a + ' 的右邊', '絕對值為 ' + Math.abs(a), '更小於 0', '與 ' + (Math.abs(a) + 1) + ' 一樣大'];
            return {
                q: '數線上點 ' + a + '。下列哪些正確？（可多選）',
                options: opts, answer: [0, 1, 2],
                explain: a + ' 是負數、絕對值 ' + Math.abs(a) + '；它小於 0，且不等於 ' + (Math.abs(a) + 1) + '。'
            };
        };
        gen.fam = 'ml.negline';
        fam(8, 'multiple', 'basic', 0, 'n-IV-2', 6, gen);
    }
    // S4 指數律（n-IV-3，目標年級>=8）
    {
        const gen = (rnd) => {
            const n = 2 + Math.floor(rnd() * 6), e1 = 2 + Math.floor(rnd() * 3), e2 = 1 + Math.floor(rnd() * 3);
            const opts = [n + '^' + e1 + ' × ' + n + '^' + e2 + ' = ' + n + '^' + (e1 + e2), '(' + n + '^' + e1 + ')^' + e2 + ' = ' + n + '^' + (e1 * e2), n + '^' + e1 + ' ÷ ' + n + '^' + e2 + ' = ' + n + '^' + (e1 - e2), n + '^' + e1 + ' + ' + n + '^' + e2 + ' 可以合併成一項指數運算'];
            return {
                q: '根據指數律，下列哪些正確？（可多選）',
                options: opts, answer: [0, 1, 2],
                explain: '指數律：同底數相乘指數相加、相除相減、幂的幂指數相乘；加法無法合併指數，最後一項錯誤。'
            };
        };
        gen.fam = 'ml.exp';
        fam(8, 'multiple', 'pro', 0, 'n-IV-3', 5, gen);
    }
    // ---------------- challenge 層題組（供高年級 challenge 配額） ----------------
    // tf.chal6 — 因數倍數進階（n-III-3，from 6）
    {
        const gen = (rnd) => {
            const a = 4 + Math.floor(rnd() * 30), b = 4 + Math.floor(rnd() * 30);
            const g = gcdOf(a, b);
            const claim = a + ' 和 ' + b + ' 互質（最大公因數為 1）';
            const ok = g === 1;
            return {
                q: '判斷是否正確：「' + claim + '」', options: ['是', '非'], answer: [ok ? 0 : 1],
                explain: (ok ? '正確。' : '錯誤。') + a + ' 和 ' + b + ' 的最大公因數為 ' + g + (g === 1 ? '，兩數互質。' : '，不互質。')
            };
        };
        gen.fam = 'tf.chal6';
        fam(6, 'tf', 'challenge', 0, 'n-III-3', 3, gen);
    }
    // tf.chal8 — 負數運算進階（n-IV-2，from 8）
    {
        const gen = (rnd) => {
            const a = 2 + Math.floor(rnd() * 15), b = 2 + Math.floor(rnd() * 15);
            const right = -(a * b);
            const wrong = rnd() < 0.5;
            const shown = wrong ? (right + 1) : right;
            return {
                q: '判斷算式是否正確：「-' + a + ' × ' + b + ' = ' + shown + '」', options: ['是', '非'], answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。負 × 正 = 負，' + a + ' × ' + b + ' = ' + (a * b) + '，答案應為 ' + right + '。'
                    : '正確。-' + a + ' × ' + b + ' = ' + right + '。'
            };
        };
        gen.fam = 'tf.chal8';
        fam(8, 'tf', 'challenge', 0, 'n-IV-2', 3, gen);
    }
    // sp.chal6 — 因數個數（n-III-3，from 6）
    {
        const gen = (rnd) => {
            const n = [12, 18, 20, 24, 30, 36][Math.floor(rnd() * 6)];
            const dc = divisorCount(n);
            const correct = String(dc);
            const distract = [String(dc - 1), String(dc + 1), String(dc + 2)];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: n + ' 的因數總共有幾個？', options: all, answer: [all.indexOf(correct)],
                explain: n + ' 的因數共有 ' + dc + ' 個（完整列出後計數即可）。'
            };
        };
        gen.fam = 'sp.chal6';
        fam(6, 'single', 'challenge', 0, 'n-III-3', 3, gen);
    }
    // sp.chal8 — 負數情境（n-IV-2，from 8）
    {
        const gen = (rnd) => {
            const start = -(1 + Math.floor(rnd() * 10)), rise = 3 + Math.floor(rnd() * 14);
            const correct = String(start + rise);
            const distract = [String(-start + rise), String(start - rise), String(Math.abs(start) + rise)];
            const all = shuffleWithRnd([correct, ...distract], rnd);
            return {
                q: '氣溫從 ' + start + ' 度上升 ' + rise + ' 度後是幾度？', options: all, answer: [all.indexOf(correct)],
                explain: start + ' + ' + rise + ' = ' + correct + ' 度（負數加上足夠大的正數可過 0）。'
            };
        };
        gen.fam = 'sp.chal8';
        fam(8, 'single', 'challenge', 0, 'n-IV-2', 3, gen);
    }
    // ml.chal6 — 等值分數進階（from 6）
    {
        const gen = () => {
            const opts = ['3 / 4 與 6 / 8 相等', '3 / 4 比 1 小', '3 / 4 的分子分母同乘 2 得 6 / 8', '3 / 4 + 6 / 8 = 9 / 12'];
            return {
                q: '關於分數，下列哪些正確？（可多選）', options: opts, answer: [0, 1, 2],
                explain: '等值分數：分子分母同乘同除不變，故相等且同法可得 6 / 8；分數必小於 1；相加須先通分，得 3 / 4 + 6 / 8 = 12 / 8，不是 9 / 12。'
            };
        };
        gen.fam = 'ml.chal6';
        fam(6, 'multiple', 'challenge', 0, 'n-III-6', 3, gen);
    }
    // ml.chal8 — 負數與指數進階（from 8）
    {
        const gen = () => {
            const opts = ['-3 - (-5) = 2', '(-2) × (-3) = 6', '-2 × 3 = -6', '(-2)^2 = -4'];
            return {
                q: '關於整數運算，下列哪些正確？（可多選）', options: opts, answer: [0, 1, 2],
                explain: '-3 + 5 = 2、負負得正、負正得負皆對；(-2)^2 = 4，最後一項錯誤。'
            };
        };
        gen.fam = 'ml.chal8';
        fam(8, 'multiple', 'challenge', 0, 'n-IV-2', 3, gen);
    }
}


// 課綱條目代碼小工具（避免 kf 字串內嵌條件出錯）
function mul_src(fid) { return fid === 'tf.mul' ? 'n-I-4' : 'n-II-3'; }


// Browser: expose a global so item-bank.js can rebuild the generators.
if (typeof window !== 'undefined') {
    window.mathTemplates = { buildMath, gcdOf, lcmOf, isPrime, divisorCount, shuffleWithRnd, SCOPE_KEYWORDS, scopeViolation };
}
// Node (build script): CommonJS export.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildMath, gcdOf, lcmOf, isPrime, divisorCount, shuffleWithRnd, SCOPE_KEYWORDS, scopeViolation };
}