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
    // 除法是「被除數 ÷ 除數 = 商」，乘積位置放的是商（c），不是乘積（c×b）：
    // 若題面寫成 (c×b) ÷ b = c×b，該算式本身為假，却被 answer 標成「是」，
    // 學生答對反而被扣分。這裡先把除法的左運算元與商分開。
    ['tf.mul', 'tf.div'].forEach(fid => {
        const gen = (rnd) => {
            const mul = fid === 'tf.mul';
            // n-I-4 的範圍是「九九乘法表」，兩個因數都應落在 2-9；
            // 原本會抽到 11，等於在小一的卷子上考 11×11，超出課綱。
            const b = 2 + Math.floor(rnd() * 8);
            let left, right;              // left op b = right（真正正確的等式）
            if (mul) { left = 2 + Math.floor(rnd() * 8); right = left * b; }
            else {
                // 商 c >= 1、被除數 c*b，保證整除且不出現 0
                const c = 1 + Math.floor(rnd() * 9);
                left = c * b; right = c;
            }
            const wrong = rnd() < 0.5;
            const shown = wrong ? right + 1 + Math.floor(rnd() * 3) : right;
            const op = mul ? ' × ' : ' ÷ ';
            return {
                q: '判斷算式是否正確：' + left + op + b + ' = ' + shown,
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。' + left + op + b + ' 應為 ' + right + '，題目寫成 ' + shown + '。'
                    : '正確。' + left + op + b + ' = ' + right + '。'
            };
        };
        gen.fam = fid;
        // tf.div 的課綱代碼是 n-II-3（S2，3-4 年級），scope 跟著代碼走，
        // 不能停在 2（S1），否則小二就會考到三年級的除法。
        fam(fid === 'tf.div' ? 4 : 2, 'tf', 'basic', 0, mul_src(fid), 4, gen);
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
        // tf.frac2 自己標的是 n-II-6（S2），註冊到 4；tf.frac 是 n-I-6（S1）留在 2。
        fam(i === 0 ? 2 : 4, 'tf', 'basic', 0, i === 0 ? 'n-I-6' : 'n-II-6', 3, gen);
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
        // n-II-9 是 S2（3-4 年級）的單位換算，不是 S1，scope 改 4。
        fam(4, 'tf', 'basic', 0, 'n-II-9', 4, gen);
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
    // 比值與比例（S4）
    {
        const gen = (rnd) => {
            const a = 2 + Math.floor(rnd() * 6);
            const b = a + 1 + Math.floor(rnd() * 5);
            const k = 2 + Math.floor(rnd() * 5);
            const opts = [
                a + ' : ' + b + ' 的比值是 ' + a + '／' + b,
                a + ' : ' + b + ' 前項和後項同乘以 ' + k + ' 後，比值不變',
                a + ' : ' + b + ' 和 ' + (a * k) + ' : ' + (b * k) + ' 相等',
                a + ' : ' + b + ' 的比值是 ' + b + '／' + a
            ];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於比值 ' + a + ' : ' + b + '，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '比值是前項除以後項，所以 ' + a + ' : ' + b + ' 的比值是 ' + a + '／' + b + '。前項和後項同乘以（或同除以）一個不為 0 的數，比值不變，因此和 ' + (a * k) + ' : ' + (b * k) + ' 相等。最後一項把前後項顛倒，比值會變成倒數，是錯的。'
            };
        };
        gen.fam = 'ml.ratio8';
        fam(8, 'multiple', 'pro', 0, 'n-IV-9', 2, gen);
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
// ==========================================================================
    // 補足「各學習階段自己的題組數量」（2026-10-12）
    //
    // 為什麼要補：drawItems 會用 diffQuota 的難度配額抽題，但一個階段若只有少數
    // 個 family，配額就會被更早階段（scope 較小）的 family 填掉——實測國中數學卷
    // 仍有 22~31% 是 scope ≤ 4 的中年級題。每個 family 一張卷最多出 2 題
    // （drawItems 的 SIG_CAP），所以「本階段 family 數 × 2」必須足以覆蓋配額。
    // mathspec.js 量出各 (階段,題型,難度) 的缺口，這裡逐格補齊。
    // ==========================================================================

    // ---- S2（中年級；目標年級 4-5）------------------------------------------
    // 四捨五入取到十位
    {
        const gen = (rnd) => {
            const a = 101 + Math.floor(rnd() * 800);
            const right = Math.round(a / 10) * 10;
            const wrong = rnd() < 0.5;
            const shown = wrong ? right + (rnd() < 0.5 ? -10 : 10) : right;
            return {
                q: '判斷是否正確：' + a + ' 用四捨五入法取到十位是 ' + shown,
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。' + a + ' 的個位數字是 ' + (a % 10) + '，四捨五入取到十位後應該是 ' + right + '。'
                    : '正確。' + a + ' 的個位數字是 ' + (a % 10) + '，取到十位後為 ' + right + '。'
            };
        };
        gen.fam = 'tf.round';
        fam(4, 'tf', 'basic', 0, 'n-II-4', 2, gen);
    }
    // 付錢找零
    {
        const gen = (rnd) => {
            const price = 15 + Math.floor(rnd() * 70);
            const right = 100 - price;
            const wrong = rnd() < 0.5;
            const shown = wrong ? right + 10 : right;
            return {
                q: '判斷是否正確：買 ' + price + ' 元的東西，付 100 元，應該找回 ' + shown + ' 元',
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。100 − ' + price + ' = ' + right + ' 元，不是 ' + shown + ' 元。'
                    : '正確。100 − ' + price + ' = ' + right + ' 元。'
            };
        };
        gen.fam = 'tf.money';
        fam(4, 'tf', 'basic', 0, 'n-II-2', 2, gen);
    }
    // 時間的加減
    {
        const gen = (rnd) => {
            const h = 7 + Math.floor(rnd() * 11);
            const m = [10, 20, 25, 40, 50][Math.floor(rnd() * 5)];
            const add = [15, 20, 30, 35, 45][Math.floor(rnd() * 5)];
            const total = h * 60 + m + add;
            const rh = Math.floor(total / 60), rm = total % 60;
            const wrong = rnd() < 0.5;
            const wm = (rm + 5) % 60;
            const shown = rh + ' 時 ' + (wrong ? wm : rm) + ' 分';
            const right = rh + ' 時 ' + rm + ' 分';
            return {
                q: '判斷是否正確：從 ' + h + ' 時 ' + m + ' 分再過 ' + add + ' 分鐘，是 ' + shown,
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。' + m + ' 分加 ' + add + ' 分是 ' + (m + add) + ' 分，換算後應為 ' + right + '。'
                    : '正確。' + m + ' 分加 ' + add + ' 分為 ' + (m + add) + ' 分，' + (m + add >= 60 ? '進位後' : '') + '是 ' + right + '。'
            };
        };
        gen.fam = 'tf.time';
        fam(4, 'tf', 'pro', 0, 'n-II-5', 1, gen);
    }
    // 長方形面積判斷
    {
        const gen = (rnd) => {
            const w = 4 + Math.floor(rnd() * 12), h = 3 + Math.floor(rnd() * 10);
            const right = w * h;
            const wrong = rnd() < 0.5;
            const shown = wrong ? right + w : right;
            return {
                q: '判斷是否正確：長 ' + w + ' 公分、寬 ' + h + ' 公分的長方形，面積是 ' + shown + ' 平方公分',
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。面積 = 長 × 寬 = ' + w + ' × ' + h + ' = ' + right + ' 平方公分。'
                    : '正確。面積 = ' + w + ' × ' + h + ' = ' + right + ' 平方公分。'
            };
        };
        gen.fam = 'tf.area';
        fam(4, 'tf', 'challenge', 0, 'n-II-9', 1, gen);
    }
    // 長方形面積
    {
        const gen = (rnd) => {
            const w = 4 + Math.floor(rnd() * 13), h = 4 + Math.floor(rnd() * 11);
            const correct = (w * h) + ' 平方公分';
            const cands = [(w + h) + ' 平方公分', (w * h + w) + ' 平方公分', (w * h - h) + ' 平方公分'];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '一個長方形的長是 ' + w + ' 公分、寬是 ' + h + ' 公分，面積是多少平方公分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '面積 = 長 × 寬 = ' + w + ' × ' + h + ' = ' + (w * h) + ' 平方公分。'
            };
        };
        gen.fam = 'sg.area';
        fam(4, 'single', 'basic', 0, 'n-II-9', 2, gen);
    }
    // 二位數除以一位數（有餘數）
    {
        const gen = (rnd) => {
            const d = 3 + Math.floor(rnd() * 7);
            const qq = 4 + Math.floor(rnd() * 12);
            const r = 1 + Math.floor(rnd() * (d - 1));
            const n = d * qq + r;
            const correct = qq + ' 餘 ' + r;
            const cands = [qq + ' 餘 ' + (r + 1), (qq + 1) + ' 餘 ' + r, String(qq)];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: n + ' ÷ ' + d + ' 的商和餘數分別是多少？',
                options: all, answer: [all.indexOf(correct)],
                explain: d + ' × ' + qq + ' = ' + (d * qq) + '，' + n + ' − ' + (d * qq) + ' = ' + r + '，所以商是 ' + qq + '、餘數是 ' + r + '。'
            };
        };
        gen.fam = 'sg.div2';
        fam(4, 'single', 'basic', 0, 'n-II-3', 2, gen);
    }
    // 長方形周長
    {
        const gen = (rnd) => {
            const h = 3 + Math.floor(rnd() * 8);
            const w = h + 2 + Math.floor(rnd() * 6);
            const correct = (2 * (w + h)) + ' 公分';
            const cands = [(w * h) + ' 公分', (w + h) + ' 公分', (2 * w + h) + ' 公分'];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '一個長方形的長是 ' + w + ' 公分、寬是 ' + h + ' 公分，周長是多少公分？',
                options: all, answer: [all.indexOf(correct)],
                explain: '周長 = (長 + 寬) × 2 = (' + w + ' + ' + h + ') × 2 = ' + (2 * (w + h)) + ' 公分。'
            };
        };
        gen.fam = 'sg.perim2';
        fam(4, 'single', 'pro', 0, 'n-II-9', 2, gen);
    }
    // 同分母分數加法
    {
        const gen = (rnd) => {
            const d = 5 + Math.floor(rnd() * 8);
            const a = 1 + Math.floor(rnd() * Math.max(1, Math.floor((d - 2) / 2)));
            const b = a + 1 + Math.floor(rnd() * Math.max(1, d - a - 1));
            const s = a + b;
            const correct = '(' + s + ')／' + d;
            const cands = ['(' + s + ')／' + (2 * d), '(' + (a * b) + ')／' + d, '(' + (a + b + d) + ')／' + d];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '計算 ' + a + '／' + d + ' + ' + b + '／' + d + ' = ？',
                options: all, answer: [all.indexOf(correct)],
                explain: '同分母分數相加，分母不變、分子相加：' + a + ' + ' + b + ' = ' + s + '，所以答案是 ' + s + '／' + d + '。'
            };
        };
        gen.fam = 'sg.fracadd';
        fam(4, 'single', 'pro', 0, 'n-II-6', 2, gen);
    }
    // 兩步驟加減
    {
        const gen = (rnd) => {
            const base = 120 + Math.floor(rnd() * 400);
            const got = 20 + Math.floor(rnd() * 90);
            const used = 10 + Math.floor(rnd() * 60);
            const correct = String(base + got - used);
            const cands = [String(base + got + used), String(base + got), String(base - got - used)];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '書局原有 ' + base + ' 本書，進貨 ' + got + ' 本後又賣出 ' + used + ' 本，現在還有幾本？',
                options: all, answer: [all.indexOf(correct)],
                explain: base + ' + ' + got + ' − ' + used + ' = ' + (base + got - used) + ' 本。'
            };
        };
        gen.fam = 'sg.two2';
        fam(4, 'single', 'challenge', 0, 'n-II-4', 2, gen);
    }
    // 小數比大小
    {
        const gen = (rnd) => {
            const x = (10 + Math.floor(rnd() * 60)) / 10;
            const d = (1 + Math.floor(rnd() * 30)) / 10;
            const y = Math.round((x + d) * 10) / 10;
            const opts = [
                x + ' 比 ' + y + ' 小',
                y + ' 比 ' + x + ' 大',
                x + ' 比 ' + y + ' 大',
                x + ' 和 ' + y + ' 一樣大'
            ];
            const correctTexts = [opts[0], opts[1]];
            const order = shuffleWithRnd(opts.map((t, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '比較 ' + x + ' 和 ' + y + ' 這兩個小數，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(t => shuffled.indexOf(t)).sort((a2, b2) => a2 - b2),
                explain: '比較小數時先比整數部分，整數部分相同再依序比十分位、百分位。' + x + ' < ' + y + '，所以「' + x + ' 比 ' + y + ' 小」與「' + y + ' 比 ' + x + ' 大」都正確。'
            };
        };
        gen.fam = 'ml.dec';
        fam(4, 'multiple', 'basic', 0, 'n-II-7', 2, gen);
    }
    // 三位數的位值
    {
        const gen = (rnd) => {
            const h = 1 + Math.floor(rnd() * 8);
            const t = Math.floor(rnd() * 10);
            let u = Math.floor(rnd() * 10);
            if (u === h) u = (u + 1) % 10;
            const n = h * 100 + t * 10 + u;
            const opts = [
                n + ' 的百位數字是 ' + h,
                n + ' 的十位數字是 ' + t,
                n + ' 的百位數字代表 ' + h + ' 個 100',
                n + ' 的個位數字是 ' + h
            ];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於三位數 ' + n + '，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: n + ' 的百位是 ' + h + '、十位是 ' + t + '、個位是 ' + u + '；百位的 ' + h + ' 代表 ' + h + ' 個 100。第 4 項說個位是 ' + h + '，實際上個位是 ' + u + '。'
            };
        };
        gen.fam = 'ml.place';
        fam(4, 'multiple', 'basic', 0, 'n-II-1', 2, gen);
    }
    // 長方形的性質
    {
        const gen = (rnd) => {
            const h = 4 + Math.floor(rnd() * 7);
            const w = h + 1 + Math.floor(rnd() * 6);
            const opts = [
                '兩組對邊分別等長',
                '四個角都是直角',
                '周長是 ' + (2 * (w + h)) + ' 公分',
                '面積是 ' + (w + h) + ' 平方公分'
            ];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '一個長 ' + w + ' 公分、寬 ' + h + ' 公分的長方形，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '長方形兩組對邊等長、四個角都是直角，周長 = (' + w + ' + ' + h + ') × 2 = ' + (2 * (w + h)) + ' 公分。面積是 ' + w + ' × ' + h + ' = ' + (w * h) + ' 平方公分，不是 ' + (w + h) + '。'
            };
        };
        gen.fam = 'ml.geom';
        fam(4, 'multiple', 'basic', 0, 'n-II-9', 2, gen);
    }
    // 同分母分數的比較與加法
    {
        const gen = (rnd) => {
            const d = 6 + Math.floor(rnd() * 7);
            const a = 1 + Math.floor(rnd() * Math.max(1, d - 3));
            const b = a + 1 + Math.floor(rnd() * Math.max(1, d - a - 1));
            const opts = [
                a + '／' + d + ' 比 ' + b + '／' + d + ' 小',
                '同分母分數相加時，分母保持不變',
                a + '／' + d + ' + ' + b + '／' + d + ' = ' + (a + b) + '／' + d,
                a + '／' + d + ' + ' + b + '／' + d + ' = ' + (a + b) + '／' + (2 * d)
            ];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於 ' + a + '／' + d + ' 和 ' + b + '／' + d + ' 這兩個分數，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '分母相同時，分子越大分數越大，所以 ' + a + '／' + d + ' 比 ' + b + '／' + d + ' 小；相加時分母不變，' + a + ' + ' + b + ' = ' + (a + b) + '，和是 ' + (a + b) + '／' + d + '。'
            };
        };
        gen.fam = 'ml.dfrac';
        fam(4, 'multiple', 'pro', 0, 'n-II-6', 2, gen);
    }
    // 公尺與公分
    {
        const gen = (rnd) => {
            const m = 1 + Math.floor(rnd() * 8);
            const opts = [
                m + ' 公尺 = ' + (m * 100) + ' 公分',
                (m * 100) + ' 公分 = ' + m + ' 公尺',
                m + ' 公尺 = ' + (m * 10) + ' 公分',
                m + ' 公尺 = ' + (m * 1000) + ' 公分'
            ];
            const correctTexts = [opts[0], opts[1]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於長度單位「公尺」和「公分」的換算，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '1 公尺 = 100 公分，所以 ' + m + ' 公尺 = ' + (m * 100) + ' 公分。' + (m * 10) + ' 公分只有 ' + (m * 10 / 100) + ' 公尺，' + (m * 1000) + ' 公分則是 ' + (m * 10) + ' 公尺，都不對。'
            };
        };
        gen.fam = 'ml.unit';
        fam(4, 'multiple', 'pro', 0, 'n-II-5', 4, gen);
    }
    // 角度：銳角與餘角
    {
        const gen = (rnd) => {
            const a = 20 + Math.floor(rnd() * 70);
            const comp = 90 - a;
            const opts = [
                a + ' 度的角是銳角',
                a + ' 度的角和 ' + comp + ' 度的角合起來是直角',
                a + ' 度的角，餘角是 ' + comp + ' 度',
                a + ' 度的角，補角是 ' + comp + ' 度'
            ];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於一個 ' + a + ' 度的角，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: a + ' 度小於 90 度，是銳角；兩角相加等於 90 度時互為餘角，所以餘角是 90 − ' + a + ' = ' + comp + ' 度。補角要和它相加等於 180 度，應該是 ' + (180 - a) + ' 度，不是 ' + comp + ' 度。'
            };
        };
        gen.fam = 'ml.angle';
        fam(4, 'multiple', 'challenge', 0, 'n-II-9', 2, gen);
    }

    // ---- S3（高年級；目標年級 6-7）------------------------------------------
    // 因數的判斷
    {
        const gen = (rnd) => {
            const n = 12 + Math.floor(rnd() * 40);
            const ds = []; for (let i = 2; i < n; i++) if (n % i === 0) ds.push(i);
            const nd = []; for (let i = 2; i < n; i++) if (n % i !== 0) nd.push(i);
            if (!ds.length || !nd.length) return gen(rnd);
            const d = ds[Math.floor(rnd() * ds.length)];
            const e = nd[Math.floor(rnd() * nd.length)];
            const askYes = rnd() < 0.5;
            const v = askYes ? d : e;
            return {
                q: '判斷是否正確：' + v + ' 是 ' + n + ' 的因數',
                options: ['是', '非'],
                answer: [askYes ? 0 : 1],
                explain: askYes
                    ? '正確。' + n + ' ÷ ' + v + ' = ' + (n / v) + '，可以整除，所以 ' + v + ' 是 ' + n + ' 的因數。'
                    : '不正確。' + n + ' ÷ ' + v + ' 不能整除，所以 ' + v + ' 不是 ' + n + ' 的因數。'
            };
        };
        gen.fam = 'tf.factor';
        fam(6, 'tf', 'basic', 0, 'n-III-3', 2, gen);
    }
    // 分數的等值
    {
        const gen = (rnd) => {
            const b = 3 + Math.floor(rnd() * 7);
            const a = 1 + Math.floor(rnd() * (b - 1));
            const k = 2 + Math.floor(rnd() * 5);
            const wrong = rnd() < 0.5;
            const sa = wrong ? a * k + 1 : a * k, sb = b * k;
            return {
                q: '判斷是否正確：' + a + '／' + b + ' 和 ' + sa + '／' + sb + ' 相等',
                options: ['是', '非'],
                answer: [wrong ? 1 : 0],
                explain: wrong
                    ? '不正確。分子和分母要同時乘以相同的數才會等值：' + a + '／' + b + ' = ' + (a * k) + '／' + (b * k) + '，不是 ' + sa + '／' + sb + '。'
                    : '正確。分子分母同乘以 ' + k + '：' + a + '／' + b + ' = ' + (a * k) + '／' + (b * k) + '。'
            };
        };
        gen.fam = 'tf.frac';
        fam(6, 'tf', 'basic', 0, 'n-III-4', 2, gen);
    }
    // 因數的個數
    {
        const gen = (rnd) => {
            const n = 12 + Math.floor(rnd() * 30);
            const c = divisorCount(n);
            const correct = c + ' 個';
            const cands = [(c + 1) + ' 個', (c - 1) + ' 個', (c + 2) + ' 個'];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: n + ' 的所有正因數共有幾個？',
                options: all, answer: [all.indexOf(correct)],
                explain: '列出所有能整除 ' + n + ' 的正整數，共有 ' + c + ' 個。'
            };
        };
        gen.fam = 'sg.factor';
        fam(6, 'single', 'basic', 0, 'n-III-3', 2, gen);
    }
    // 一位小數乘以整數
    {
        const gen = (rnd) => {
            const a = 2 + Math.floor(rnd() * 8);
            let b; let guard = 0;
            do { b = (5 + Math.floor(rnd() * 95)) / 10; guard++; }
            while (Math.abs(a * b - (a + b)) < 0.05 && guard < 30);
            const prod = Math.round(a * b * 10) / 10;
            const correct = prod + '';
            const cands = [(Math.round((prod + a) * 10) / 10) + '', (Math.round((prod + 0.1) * 10) / 10) + '', (Math.round((a + b) * 10) / 10) + ''];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: a + ' × ' + b + ' = ？',
                options: all, answer: [all.indexOf(correct)],
                explain: a + ' × ' + b + ' = ' + prod + '（先算 ' + a + ' × ' + (b * 10) + ' = ' + (a * b * 10) + '，再除以 10）。'
            };
        };
        gen.fam = 'sg.dec2';
        fam(6, 'single', 'basic', 0, 'n-III-5', 2, gen);
    }
    // 因數與倍數（多選）
    {
        const gen = (rnd) => {
            const n = 6 + Math.floor(rnd() * 18);
            const k = 2 + Math.floor(rnd() * 5);
            const opts = [
                (n * k) + ' 是 ' + n + ' 的倍數',
                n + ' 是 ' + (n * k) + ' 的因數',
                n + ' 是 ' + (n * k) + ' 的倍數',
                (n * k) + ' 是 ' + n + ' 的因數'
            ];
            const correctTexts = [opts[0], opts[1]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於 ' + n + ' 和 ' + (n * k) + ' 這兩個數，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: n + ' × ' + k + ' = ' + (n * k) + '，所以 ' + (n * k) + ' 是 ' + n + ' 的倍數，反過來說 ' + n + ' 是 ' + (n * k) + ' 的因數。倍數和因數的關係是互相對應的，不能顛倒。'
            };
        };
        gen.fam = 'ml.factor';
        fam(6, 'multiple', 'basic', 0, 'n-III-3', 2, gen);
    }
    // 倍數的判斷
    {
        const gen = (rnd) => {
            const n = 3 + Math.floor(rnd() * 9);
            const k = 3 + Math.floor(rnd() * 9);
            const right = n * k;
            const off = right + 1 + Math.floor(rnd() * (n - 1));
            const opts = [
                right + ' 是 ' + n + ' 的倍數',
                off + ' 是 ' + n + ' 的倍數',
                right + ' 能被 ' + n + ' 整除',
                off + ' 能被 ' + n + ' 整除'
            ];
            const correctTexts = [opts[0], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: n + ' × ' + k + ' = ' + right + '，所以 ' + right + ' 是 ' + n + ' 的倍數、也能被 ' + n + ' 整除。' + off + ' ÷ ' + n + ' 不能整除，所以 ' + off + ' 不是 ' + n + ' 的倍數。'
            };
        };
        gen.fam = 'ml.multiple';
        fam(6, 'multiple', 'basic', 0, 'n-III-3', 2, gen);
    }
    // 質數與合數
    {
        const gen = (rnd) => {
            const cand = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
            const p = cand[Math.floor(rnd() * cand.length)];
            const c = p + 3; // 偶數且 >2，必為合數
            const opts = [
                p + ' 是質數',
                c + ' 是合數',
                p + ' 是合數',
                c + ' 是質數'
            ];
            const correctTexts = [opts[0], opts[1]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: p + ' 只有 1 和本身兩個因數，是質數；' + c + ' 除了 1 和本身還有其他因數，是合數。'
            };
        };
        gen.fam = 'ml.prime';
        fam(6, 'multiple', 'basic', 0, 'n-III-3', 2, gen);
    }
    // 比例關係
    {
        const gen = (rnd) => {
            const unit = 3 + Math.floor(rnd() * 12);
            const n = 2 + Math.floor(rnd() * 6);
            const m = n + 1 + Math.floor(rnd() * 4);
            const opts = [
                n + ' 個要 ' + (unit * n) + ' 元',
                m + ' 個要 ' + (unit * m) + ' 元',
                '每個 ' + unit + ' 元，數量越多總價越高',
                m + ' 個要 ' + (unit * n) + ' 元'
            ];
            const correctTexts = [opts[0], opts[1], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '一個 ' + unit + ' 元的東西，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '單價固定時，總價和數量成正比：' + n + ' 個是 ' + unit + ' × ' + n + ' = ' + (unit * n) + ' 元，' + m + ' 個是 ' + unit + ' × ' + m + ' = ' + (unit * m) + ' 元。最後一項把 ' + m + ' 個的總價寫成 ' + n + ' 個的價錢，是錯的。'
            };
        };
        gen.fam = 'ml.prop';
        fam(6, 'multiple', 'pro', 0, 'n-III-9', 2, gen);
    }
    // 平均數
    {
        const gen = (rnd) => {
            const avg = 60 + Math.floor(rnd() * 30);
            const n = 3 + Math.floor(rnd() * 3);
            const total = avg * n;
            const v = []; let rest = total;
            for (let i = 0; i < n - 1; i++) { const off = Math.floor(rnd() * 11) - 5; v.push(avg + off); rest -= (avg + off); }
            v.push(rest);
            const opts = [
                '這 ' + n + ' 個數的平均是 ' + avg,
                '這 ' + n + ' 個數的總和是 ' + total,
                '這 ' + n + ' 個數的平均是 ' + (total + 1),
                '這 ' + n + ' 個數的總和是 ' + (avg + n)
            ];
            const correctTexts = [opts[0], opts[1]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '有 ' + n + ' 個數，總和是 ' + total + '，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '平均數 = 總和 ÷ 個數 = ' + total + ' ÷ ' + n + ' = ' + avg + '。總和是 ' + total + '，不是 ' + (avg + n) + '。'
            };
        };
        gen.fam = 'ml.avg';
        fam(6, 'multiple', 'pro', 0, 'n-III-8', 2, gen);
    }

    // ---- S4（國中；目標年級 8-10）-------------------------------------------
    // 負數的大小與絕對值
    {
        const gen = (rnd) => {
            const a = -(1 + Math.floor(rnd() * 20));
            const b = 1 + Math.floor(rnd() * 20);
            const correct = Math.abs(a) + '';
            const cands = [String(a), String(b), String(-Math.abs(a))];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '|' + a + '| 的值是多少？',
                options: all, answer: [all.indexOf(correct)],
                explain: '絕對值表示在數線上與 0 的距離，所以 |' + a + '| = ' + Math.abs(a) + '。'
            };
        };
        gen.fam = 'tf.negabs';
        fam(8, 'tf', 'basic', 0, 'n-IV-2', 1, gen);
    }
    // 科學記號
    {
        const gen = (rnd) => {
            const d = (1 + Math.floor(rnd() * 9)) + '.' + (1 + Math.floor(rnd() * 9));
            const k = 2 + Math.floor(rnd() * 5);
            const n = Math.round(parseFloat(d) * Math.pow(10, k));
            const correct = d + ' × 10^' + k;
            const cands = [d + ' × 10^' + (k + 1), d + ' × 10^-' + k, d + ' × 10^' + (k - 1)];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '將 ' + n + ' 表示成科學記號，下列哪一個正確？',
                options: all, answer: [all.indexOf(correct)],
                explain: '科學記號寫成 a × 10^n，其中 1 ≤ a < 10。' + n + ' = ' + d + ' × 10^' + k + '。'
            };
        };
        gen.fam = 'sg.sci';
        fam(8, 'single', 'basic', 0, 'n-IV-3', 2, gen);
    }
    // 平方根
    {
        const gen = (rnd) => {
            const k = 3 + Math.floor(rnd() * 16);
            const n = k * k;
            const correct = String(k);
            const cands = [String(k + 1), String(k - 1), String(2 * k)];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '√' + n + ' = ？',
                options: all, answer: [all.indexOf(correct)],
                explain: k + ' × ' + k + ' = ' + n + '，且 ' + k + ' 為正數，所以 √' + n + ' = ' + k + '。'
            };
        };
        gen.fam = 'sg.root';
        fam(8, 'single', 'pro', 0, 'n-IV-5', 3, gen);
    }
    // 等差數列的第 n 項
    {
        const gen = (rnd) => {
            const a1 = 2 + Math.floor(rnd() * 9);
            const d = 2 + Math.floor(rnd() * 8);
            const n = 6 + Math.floor(rnd() * 8);
            const an = a1 + (n - 1) * d;
            const correct = String(an);
            const cands = [String(a1 + n * d), String(a1 + (n - 2) * d), String(an + d)];
            const all = shuffleWithRnd([correct, ...cands], rnd);
            return {
                q: '等差數列的首項是 ' + a1 + '、公差是 ' + d + '，第 ' + n + ' 項是多少？',
                options: all, answer: [all.indexOf(correct)],
                explain: '第 n 項 = 首項 + (n − 1) × 公差 = ' + a1 + ' + ' + (n - 1) + ' × ' + d + ' = ' + an + '。'
            };
        };
        gen.fam = 'sg.seq';
        fam(8, 'single', 'challenge', 0, 'n-IV-7', 2, gen);
    }
    // 負數的加減
    {
        const gen = (rnd) => {
            const a = -(1 + Math.floor(rnd() * 20));
            const b = -(1 + Math.floor(rnd() * 20));
            const s = a + b;
            const opts = [
                a + ' + ' + b + ' = ' + s,
                a + ' + ' + b + ' 的結果是負數',
                a + ' + ' + b + ' = ' + (-s),
                a + ' + ' + b + ' 的結果是正數'
            ];
            const correctTexts = [opts[0], opts[1]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於 ' + a + ' + ' + b + '，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '兩個負數相加，取相同的負號並把絕對值相加：' + a + ' + ' + b + ' = ' + s + '，結果仍為負數。'
            };
        };
        gen.fam = 'ml.neg';
        fam(8, 'multiple', 'basic', 0, 'n-IV-2', 2, gen);
    }
    // 指數律
    {
        const gen = (rnd) => {
            const a = 2 + Math.floor(rnd() * 4);
            const m = 2 + Math.floor(rnd() * 4);
            const n = 2 + Math.floor(rnd() * 4);
            const p = a * a, q = a * a * a;
            const opts = [
                a + '^' + m + ' × ' + a + '^' + n + ' = ' + a + '^' + (m + n),
                a + '^' + m + ' × ' + a + '^' + n + ' = ' + a + '^' + (m * n),
                a + '^' + m + ' ÷ ' + a + '^' + n + ' = ' + a + '^' + (m - n),
                a + '^' + m + ' ÷ ' + a + '^' + n + ' = ' + a + '^' + (n - m)
            ];
            const correctTexts = [opts[0], opts[2]];
            const order = shuffleWithRnd(opts.map((x, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於指數律（' + a + ' > 0），下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(x => shuffled.indexOf(x)).sort((a2, b2) => a2 - b2),
                explain: '同底數相乘，指數相加：' + a + '^' + m + ' × ' + a + '^' + n + ' = ' + a + '^' + (m + n) + '；同底數相除，指數相減：' + a + '^' + m + ' ÷ ' + a + '^' + n + ' = ' + a + '^' + (m - n) + '。指數是相加相減，不是相乘。'
            };
        };
        gen.fam = 'ml.exp';
        fam(8, 'multiple', 'pro', 0, 'n-IV-3', 2, gen);
    }
    // 一元一次方程式
    {
        const gen = (rnd) => {
            const a = 2 + Math.floor(rnd() * 7);
            const x = 2 + Math.floor(rnd() * 9);
            const b = 1 + Math.floor(rnd() * 15);
            const c = a * x + b;
            const opts = [
                a + 'x + ' + b + ' = ' + c + ' 的解是 x = ' + x,
                a + 'x + ' + b + ' = ' + c + ' 的解是 x = ' + (x + 1),
                '將 ' + b + ' 移到等號右邊要變成減 ' + b,
                a + 'x = ' + c + ' 的解是 x = ' + c
            ];
            const correctTexts = [opts[0], opts[2]];
            const order = shuffleWithRnd(opts.map((y, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '解一元一次方程式 ' + a + 'x + ' + b + ' = ' + c + '，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(y => shuffled.indexOf(y)).sort((a2, b2) => a2 - b2),
                explain: '等量公理：兩邊同減 ' + b + ' 得 ' + a + 'x = ' + (c - b) + '，再同除以 ' + a + ' 得 x = ' + x + '。移項時加號變減號、減號變加號。'
            };
        };
        gen.fam = 'ml.eq';
        fam(8, 'multiple', 'pro', 0, 'a-IV-2', 2, gen);
    }
    // 二元一次方程式
    {
        const gen = (rnd) => {
            const a = 1 + Math.floor(rnd() * 5);
            const b = 1 + Math.floor(rnd() * 5);
            const x = 1 + Math.floor(rnd() * 7);
            const y = 1 + Math.floor(rnd() * 7);
            const c = a * x + b * y;
            const opts = [
                '(x, y) = (' + x + ', ' + y + ') 是 ' + a + 'x + ' + b + 'y = ' + c + ' 的一組解',
                '(x, y) = (' + (x + 1) + ', ' + y + ') 是 ' + a + 'x + ' + b + 'y = ' + c + ' 的一組解',
                a + 'x + ' + b + 'y = ' + c + ' 有無限多組解',
                a + 'x + ' + b + 'y = ' + c + ' 只有唯一一組解'
            ];
            const correctTexts = [opts[0], opts[2]];
            const order = shuffleWithRnd(opts.map((z, i) => i), rnd);
            const shuffled = order.map(i => opts[i]);
            return {
                q: '關於二元一次方程式 ' + a + 'x + ' + b + 'y = ' + c + '，下列哪些敘述正確？（可多選）',
                options: shuffled,
                answer: correctTexts.map(z => shuffled.indexOf(z)).sort((a2, b2) => a2 - b2),
                explain: '代入 x = ' + x + '、y = ' + y + '：' + a + ' × ' + x + ' + ' + b + ' × ' + y + ' = ' + c + '，成立。這個方程式在平面上是一條直線，直線上有無限多個點，所以有無限多組解；要有唯一解必須有兩個方程式聯立。'
            };
        };
        gen.fam = 'ml.line';
        fam(8, 'multiple', 'challenge', 0, 'a-IV-4', 2, gen);
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