// build-itembank.mjs
// Generates item-bank.js : the question bank for the grade-skip diagnostic system.
// Run: node build-itembank.mjs
//
// Item shape: { id, diff:'basic'|'pro'|'challenge', q, options:[..], answer:[idx..], explain, zhuyin? }
// zhuyin is REQUIRED for every item served to 國小一、二年級 (student grade 1-2).
// The zhuyin string is space-delimited, one syllable per Chinese character, '' for
// non-Chinese characters (digits, punctuation, latin). See renderZhuyin() in index.html.
//
// The character -> zhuyin table lives in zhuyin-table.json, generated from a
// CC-CEDICT-grade reading source by gen-zhuyin-table.py (see that file). Hand-writing
// readings was the source of the original missing-注音 bug, so it is now generated.

import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const mathTpl = require_('./math-templates.js');

const bank = {}; // bank[subject][targetGrade][type] = [items]

// Complete per-character Bopomofo table (477+ chars).
const ZY_TABLE = JSON.parse(readFileSync(new URL('./zhuyin-table.json', import.meta.url), 'utf8'));

// Render a whole sentence's zhuyin: one syllable per character, '' for
// characters with no reading (digits, punctuation, latin, spaces).
function zhuyinOf(text) {
    return Array.from(text).map(ch => ZY_TABLE[ch] ?? '').join(' ');
}

// ----------------------------------------------------------- 課綱出處 (src)
// 每題注入課綱學習重點條目的 provenance URL，供稽核（數學題另有逐題 n-I/II/III/IV 代碼）。
const MATH_SRC = 'https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11164';
const SUBJ_SRC = {
    math: MATH_SRC,
    chinese: 'https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11010',
    science: 'https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11267',
    social: 'https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11261',
    english: 'https://cirn.k12ea.gov.tw/TWELVE/List.aspx?fid=11058'
};

function push(subject, grade, type, item) {
    bank[subject] ??= {};
    bank[subject][grade] ??= { tf: [], single: [], multiple: [] };
    if (item.src === undefined) item.src = SUBJ_SRC[subject] || null; // non-math: subject default
    // 國小一、二年級（目標年級 2-3）不只要看得懂題目，也要看得懂「選項」。
    // 原本只標了題幹的注音，學生唸得出題目卻看不懂 A/B/C/D 在寫什麼。
    // 選項注音在 build 時算好存進題庫，瀏覽器端只負責畫（它沒有 zhuyin 表）。
    if (grade <= 3 && item.options && !item.optionsZhuyin) {
        item.optionsZhuyin = item.options.map(o => zhuyinOf(String(o)));
    }
    bank[subject][grade][type].push(item);
}

// ---------------------------------------------------------------- helpers
const TONE = ['ˊ', 'ˇ', 'ˋ', '˙']; // 2nd,3rd,4th,neutral (1st tone = no mark)
let uid = 0;
const nid = (s, g, t) => `${s}-${g}-${t}-${(++uid).toString(36)}`;

// Build a zhuyin string: array of syllables, one per char; null entries for
// characters that get no annotation (spaces/punctuation/latin/digits).
function zy(syllables) { return syllables.join(' '); }

// ---------------------------------------------------------------- MATH
// Maths items come from math-templates.js (shared with the browser) so the
// parameterised generators are defined exactly once.
function gcdOf(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function lcmOf(a, b) { return a / gcdOf(a, b) * b; }
function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
function divisorCount(n) { let c = 0; for (let i = 1; i <= n; i++) if (n % i === 0) c++; return c; }

// 各學習階段「該階段專屬」的題目內容（由題庫作者逐格撰寫、逐格驗證）。
// key = 科目|scope|題型；這些題目只進該階段年級的桶子，讓各年級考到不同內容。
// 每格題數已對齊 diffQuota 的需求，因此不必再用 expandVariants 循環填充
//（循環填充會讓一個階段只有 2 個相異題面，同卷去重後就漏水到低年級題）。
// 取某科目/某階段/某題型的專屬題目；缺格時回傳空陣列。
function authored(subject, scope, type) { return AUTHORED[subject + '|' + scope + '|' + type] || []; }

const AUTHORED = {
    'chinese|4|multiple': [
        { diff: 'basic', q: '下列各組詞語，哪些是「反義詞」（意思相反）？（可多選）', options: ['高興／難過', '節省／浪費', '勇敢／膽小', '朋友／同學'], answer: [0, 1, 2], explain: '「高興」和「難過」意思相反、「節省」和「浪費」意思相反、「勇敢」和「膽小」意思相反，三組都是反義詞。干擾項「朋友／同學」意思相近、屬於同類的人際關係詞，並不是相反的意思，所以不是反義詞。' },
        { diff: 'basic', q: '下列哪些字的部首是「木」？（可多選）', options: ['林', '村', '松', '休'], answer: [0, 1, 2], explain: '「林」「村」「松」三個字的意思都跟樹木有關，部首都是「木」。干擾項「休」是一個人靠在樹旁休息，部首是「人（亻）」而不是「木」，雖然字形裡有「木」，但查字典時要取「亻」部。' },
        { diff: 'basic', q: '下列哪些詞語是「狀聲詞」（摹擬聲音的詞）？（可多選）', options: ['汪汪', '吱吱', '勇敢', '叮噹'], answer: [0, 1, 3], explain: '「汪汪」摹擬狗叫聲、「吱吱」摹擬老鼠或門軸的聲音、「叮噹」摹擬金屬碰撞聲，都是狀聲詞。干擾項「勇敢」是在形容人的個性，屬於形容詞，並沒有摹擬任何聲音，所以不是狀聲詞。' },
        { diff: 'pro', q: '下列哪些關聯詞語的搭配是正確的？（可多選）', options: ['因為……所以……', '雖然……但是……', '不但……而且……', '如果……所以……'], answer: [0, 1, 2], explain: '「因為……所以……」表示因果、「雖然……但是……」表示轉折、「不但……而且……」表示遞進，三組前後搭配都正確。干擾項「如果……所以……」搭配錯誤：前面「如果」是在假設，後面應該接「就」或「那麼」，不能用表示結果的「所以」。' },
        { diff: 'pro', q: '下列哪些句子前後兩句的關係是「轉折」？（可多選）', options: ['雖然下雨了，但是他還是準時到學校。', '他雖然很累，卻仍然把功課寫完。', '因為下雨，所以比賽取消了。', '他不但會畫畫，而且會彈琴。'], answer: [0, 1], explain: '前兩句用「雖然……但是／卻……」一前一後說出相反、出乎意料的情況，屬於轉折關係。干擾項第三句「因為……所以……」是因果關係，第四句「不但……而且……」是遞進（更進一層）的關係，都不是轉折。' },
    ],
    'chinese|4|single': [
        { diff: 'basic', q: '下列哪一組詞語的意思最相近？', options: ['寒冷／炎熱', '美麗／漂亮', '安靜／吵鬧', '高興／傷心'], answer: [1], explain: '「美麗」和「漂亮」都是形容好看、令人喜歡，意思相近，屬於近義詞。其餘三組都是反義詞：「寒冷」與「炎熱」相反、「安靜」與「吵鬧」相反、「高興」與「傷心」相反。本題要選「相近」，所以不能選反義詞那三組。' },
        { diff: 'basic', q: '「蜻蜓」的「蜻」字，部首是哪一個？', options: ['虫部', '青部', '日部', '月部'], answer: [0], explain: '「蜻」是形聲字，左邊的「虫」才是部首，表示牠和昆蟲有關，用部首查字典時要查「虫部」。右邊的「青」只是提示讀音的聲旁，不是部首，所以「青部」是最容易誤選的干擾項；「日部」「月部」跟這個字無關。' },
        { diff: 'pro', q: '「難道我們可以眼睜睜看著他跌倒嗎？」這句話真正的意思是什麼？', options: ['我們可以眼睜睜看著他跌倒', '他一定會跌倒', '我們不可以眼睜睜看著他跌倒', '我們不知道該不該救他'], answer: [2], explain: '這是反問句，用問句的形式表達相反的意思；「難道……嗎？」帶有強烈的否定語氣，真正的意思是「我們不可以眼睜睜看著他跌倒」，也就是應該伸手幫忙。主要干擾項「我們可以眼睜睜看著他跌倒」是把反問句當成一般問句、照字面理解，才會得到相反的答案；「他一定會跌倒」則是把句子重點誤讀成預測結果。' },
    ],
    'chinese|4|tf': [
        { diff: 'basic', q: '「高興」和「快樂」的意思相近，是一組近義詞。', options: ['是', '非'], answer: [0], explain: '「高興」和「快樂」都表示心情愉悅，意思相近，因此是近義詞。主要干擾在於誤以為「近義詞」必須意思完全相同：近義詞只要求意思相近、用法相通，不必一字不差，所以本題應選「是」。' },
        { diff: 'basic', q: '「江」這個字的部首是「工」。', options: ['是', '非'], answer: [1], explain: '「江」的部首是「水」（三點水「氵」），查字典時歸在「水」部。右邊的「工」只是聲旁、不負責表義，是常見的干擾；只看到右邊部件就當成部首，就會誤選「是」。' },
        { diff: 'pro', q: '「這次多虧你雪中送炭，我才能度過難關。」句中的「雪中送炭」是指及時給予別人幫助。', options: ['是', '非'], answer: [0], explain: '要判定此題必須先懂成語、再套進句子的語境：「雪中送炭」比喻在別人最急需的時候及時伸出援手，對應句中「多虧你……我才能度過難關」，故為「是」。主要干擾是照字面理解成「下雪天送炭火取暖」（只描述天氣與動作），那就會誤選「非」；其實成語用的是比喻義，不是字面義。' },
    ],
    'chinese|6|multiple': [
        { diff: 'basic', q: '下列哪些標點符號可以用來表示一個句子的結束？（可多選）', options: ['句號（。）', '問號（？）', '逗號（，）', '感嘆號（！）'], answer: [0, 1, 3], explain: '句號、問號、感嘆號都放在句子最後，分別表示陳述、疑問和感嘆的語氣，所以都能表示句子結束。逗號只用在句子中間的停頓、分隔詞語或句子成分，不能結束一個句子，是主要干擾項。' },
        { diff: 'basic', q: '下列哪些組詞語彼此是「同義詞」（意思相近）？（可多選）', options: ['高興／快樂', '美麗／漂亮', '喜歡／討厭', '寒冷／冰冷'], answer: [0, 1, 3], explain: '「高興」和「快樂」、「美麗」和「漂亮」、「寒冷」和「冰冷」兩兩意思相近，都是同義詞。主要干擾項是「喜歡／討厭」，這兩個詞意思相反，是反義詞而不是同義詞。' },
        { diff: 'basic', q: '下列哪些詞語是「親屬稱謂」（用來稱呼和自己有親屬關係的人）？（可多選）', options: ['爺爺', '外婆', '表哥', '鄰居'], answer: [0, 1, 2], explain: '「爺爺」「外婆」「表哥」都是因為血緣或親屬關係而有的稱呼，屬於親屬稱謂。主要干擾項是「鄰居」，鄰居只是住得近的人，彼此之間不一定有親屬關係，所以不是親屬稱謂。' },
        { diff: 'pro', q: '下列哪些句子含有「轉折」的關係（先說一種情況，再轉到相反或不同的結果）？（可多選）', options: ['雖然下著大雨，他還是準時到學校。', '儘管很累，她仍然把功課寫完。', '因為天氣變冷，所以大家都穿上了外套。', '他功課很好，可是為人很謙虛。'], answer: [0, 1, 3], explain: '「雖然……還是」「儘管……仍然」「……可是……」都是先提出一種情況，再轉到相反或不同結果的轉折關係。主要干擾項是「因為……所以……」，它表示的是原因和結果的因果關係，句意是順著推下去的，並沒有轉折，所以不屬於轉折句。' },
        { diff: 'pro', q: '下列哪些句子使用了「排比」修辭（用三個以上結構相似的詞句並列）？（可多選）', options: ['春天來了，花開了，鳥叫了，大地醒了。', '他愛看書，愛畫畫，也愛打球。', '小鳥在樹上快樂地唱歌。', '風輕輕地吹，雨細細地下，雲慢慢地飄。'], answer: [0, 1, 3], explain: '排比要用三個以上結構相似的詞句並列：第一、二、四個選項都各有三組以上格式相近的句子（花開／鳥叫／大地醒、愛看書／愛畫畫／愛打球、風吹／雨下／雲飄）。主要干擾項是「小鳥在樹上快樂地唱歌」，它只有一個句子、結構單一，沒有並列相似結構，所以不是排比。' },
        { diff: 'pro', q: '下列哪些詞語可以用來表示「推測（不確定）」的語氣？（可多選）', options: ['可能', '也許', '一定', '大概'], answer: [0, 1, 3], explain: '「可能」「也許」「大概」都表示說話者對事情沒有把握，只是根據線索做出推測。主要干擾項是「一定」，它表示確定、肯定的判斷，語氣是斬釘截鐵的，和推測的不確定語氣相反，所以不能選。' },
    ],
    'chinese|6|single': [
        { diff: 'basic', q: '文章中的「引號（「」）」最主要的功能是什麼？', options: ['標示說話的內容或引用的詞句', '表示句子已經結束', '表示語氣停頓', '表示疑問的語氣'], answer: [0], explain: '引號「」最主要的用途是標明直接說出的話或引用的詞句（有時也用來特別強調某個詞語）。表示句子結束用句號（。），表示語氣停頓用逗號（，），表示疑問語氣用問號（？），所以其他三個選項都不對。干擾項是「表示疑問的語氣」，那是問號的功能，不是引號。' },
        { diff: 'basic', q: '下列哪一個詞語的用字完全正確？', options: ['迫不及待', '迫不急待', '破不及待', '迫不即待'], answer: [0], explain: '正確寫法是「迫不及待」，其中「及」是「來得及」的意思，表示急得等不下去。干擾項「迫不急待」最常見，容易因讀音相近而把「及」誤寫成「急」；「破」「即」也都是同音或近音的錯字，因此都不正確。' },
        { diff: 'pro', q: '下列哪一個句子「沒有」使用擬人修辭？', options: ['春風輕輕地撫摸著大地', '小草偷偷地從土裡探出頭來', '大樹在風中對我們招手', '月亮像一艘小船，靜靜掛在天上'], answer: [3], explain: '擬人是把物當成人來描寫。前三句分別用「撫摸」「探出頭」「招手」這些人的動作來寫春風、小草和大樹，都是擬人。第四句用「像」把月亮比喻成小船，屬於譬喻而不是擬人。主要干擾項是前三句裡任一句，它們其實都是擬人，不能選。' },
        { diff: 'pro', q: '下列哪一個成語最適合用來形容「事先做好準備，就能避免災禍」？', options: ['未雨綢繆', '亡羊補牢', '守株待兔', '掩耳盜鈴'], answer: [0], explain: '「未雨綢繆」指還沒下雨就先修補門窗，比喻事先做好準備，正符合題意。干擾項「亡羊補牢」是羊跑了才修羊圈，強調「出事後才補救」，時間點不同，所以不對；「守株待兔」指妄想不勞而獲，「掩耳盜鈴」指自欺欺人，都和事先準備無關。' },
    ],
    'chinese|6|tf': [
        { diff: 'basic', q: '「花兒笑了，小草也跟著點頭。」這句話使用了擬人修辭。', options: ['是', '非'], answer: [0], explain: '正確答案為「是」。擬人是把原本不會有人的動作、情感的事物，寫成會「笑」、「點頭」等人類行為。句中「花兒」會「笑」、「小草」會「點頭」，都是把小草、花朵當成人來描寫，所以是擬人修辭。主要干擾項「非」的錯誤在於：若只是單純敘述自然現象，會寫成「花開了、草在風中搖動」，不會用「笑」、「點頭」這類人的動作；本句既然用了人的動作，就不能說沒有使用擬人。此題只考擬人的定義與辨認，屬基本題。' },
        { diff: 'pro', q: '「這件事你要好好處理」的「好好」，和「他是一個好好先生」的「好好」，讀音完全相同。', options: ['是', '非'], answer: [1], explain: '正確答案為「非」。這是多音字（一字多音）的判斷。前一句「好好處理」是「認真、仔細地做」的意思，讀作ㄏㄠˇ　ㄏㄠˇ；後一句「好好先生」指誰都不得罪的人（老好人），其中的「好好」要讀作ㄏㄠˇ　ㄏㄠ，第二個字讀輕聲，兩者讀音並不相同，所以題目說「完全相同」是錯的。主要干擾項「是」的錯誤在於：看到字形相同就以為讀音一定相同，忽略了「好好先生」是固定詞語、第二個「好」要念輕聲。此題需先分辨兩處詞義，再比較讀音，屬兩步推理，難度列為 pro。' },
    ],
    'chinese|8|multiple': [
        { diff: 'basic', q: '下列哪些詞語是「擬聲詞」（模擬聲音的詞語）？', options: ['叮噹', '嘩啦', '噗通', '奔跑'], answer: [0, 1, 2], explain: '「叮噹」模擬金屬碰撞聲、「嘩啦」模擬水流聲、「噗通」模擬落水聲，三者都是直接模仿聲音的擬聲詞；「奔跑」是描述動作的動詞，本身不模擬任何聲音，是主要干擾項。' },
        { diff: 'basic', q: '下列哪些字的部首是「木」部？', options: ['林', '森', '橋', '河'], answer: [0, 1, 2], explain: '「林」「森」由樹木的象形演變而來，「橋」是木造的，三者都歸「木」部；「河」的部首是「水（氵）」部，與木無關，是主要干擾項。' },
        { diff: 'pro', q: '下列哪些句子屬於「被動句」（主語是接受動作的一方）？', options: ['他被老師稱讚了一頓。', '衣服被雨淋濕了。', '弟弟把玩具收好了。', '大樹被強風吹倒了。'], answer: [0, 1, 3], explain: '前三項（第 1、2、4 句）都用「被」引出動作，主語是「被處置、被影響」的一方，屬被動句；第 3 句用「把」字，主語「弟弟」是主動的執行者，屬於主動的「把字句」，是主要干擾項。' },
        { diff: 'pro', q: '下列哪些詞語是「音譯」的外來語（直接借用外國語的聲音）？', options: ['沙發', '巧克力', '電腦', '巴士'], answer: [0, 1, 3], explain: '「沙發」（sofa）、「巧克力」（chocolate）、「巴士」（bus）都是直接模仿外語讀音借來的音譯詞；「電腦」是依功能重新創造的意譯／新造詞，並非音譯，是主要干擾項。' },
        { diff: 'pro', q: '下列哪些句子使用了「誇飾」修辭（刻意誇大以增強效果）？', options: ['他餓得可以吃下一頭牛。', '他的聲音大得連屋頂都快被掀翻了。', '我等了一輩子才等到這一天。', '今天考試的題目比昨天簡單。'], answer: [0, 1, 2], explain: '前三句都刻意誇大事實（食量、音量、時間），以凸顯感受，屬誇飾；第四句只是就題目難易做客觀比較，說法平實、沒有誇大，是主要干擾項。' },
        { diff: 'challenge', q: '下列哪些文句「同時」使用了「譬喻」和「擬人」兩種修辭？', options: ['春風像母親的手，輕輕地撫摸著我的臉。', '太陽像個害羞的小姑娘，悄悄躲進雲朵裡。', '小鳥在枝頭上唱著悅耳的歌。', '天上的白雲像一團團柔軟的棉花糖。'], answer: [0, 1], explain: '第 1、2 句都先用「像……」把事物比擬成另一事物（譬喻），又把春風、太陽當成人來寫（撫摸、害羞、躲），兩種修辭同時出現；第 3 句只有「唱歌」的擬人，沒有譬喻；第 4 句只有「像棉花糖」的譬喻，沒有擬人。後兩句各只具備一種修辭，是主要干擾項。' },
    ],
    'chinese|8|single': [
        { diff: 'basic', q: '下列哪一個字是「象形」字？', options: ['日', '上', '休', '江'], answer: [0], explain: '「日」的字形直接描摹太陽圓形的樣子，屬於象形。干擾項「上」是在一橫上加短畫來指示方位，屬指事；「休」由「人」靠著「木」組合出新義，屬會意；「江」由形符「水」加上聲符「工」構成，屬形聲。這三者都不是直接描摹實物的形狀，故選「日」。' },
        { diff: 'basic', q: '下列詞語中，哪一個完全沒有錯別字？', options: ['按步就班', '迫不及待', '一愁莫展', '再接再勵'], answer: [1], explain: '「迫不及待」用字完全正確。干擾項「按步就班」應作「按部就班」（依部類、次序而行）；「一愁莫展」應作「一籌莫展」（「籌」是計策，無法拿出辦法）；「再接再勵」應作「再接再厲」（「厲」有磨礪之意）。三者都寫了音近的別字，只有「迫不及待」沒有錯字。' },
        { diff: 'pro', q: '下列文句中的「而」字，哪一個表示轉折（相當於「卻」）？', options: ['學而時習之', '人不知而不慍', '溫故而知新', '擇其善者而從之'], answer: [1], explain: '「人不知而不慍」前後語意相反（別人不了解我，我卻不怨恨），「而」表示轉折。其餘三句的「而」都只是連接前後兩個動作或狀態，屬順接：「學而時習之」是「學習並且時常複習」，「溫故而知新」是「溫習舊的進而知新的」，「擇其善者而從之」是「選擇好的並且跟從」。故選「人不知而不慍」。' },
        { diff: 'pro', q: '「巾幗不讓鬚眉」句中「巾幗」是用來借代什麼？', options: ['頭巾等裝飾品', '女子', '男子', '眉毛與鬍鬚'], answer: [1], explain: '「巾幗」原是古代婦女的頭巾與髮飾，後借代為「女子」，與之相對的「鬚眉」則借代「男子」。干擾項「頭巾等裝飾品」是字面意思，未掌握借代用法；「男子」和「眉毛與鬍鬚」其實是「鬚眉」所指，方向錯誤。故選「女子」。' },
        { diff: 'pro', q: '「這次比賽失利，他不但沒有灰心，反而___，更加努力練習。」空格應填入哪一個成語？', options: ['愈挫愈勇', '自暴自棄', '一蹶不振', '得意忘形'], answer: [0], explain: '句意說他失敗後反而更努力，最適合填「愈挫愈勇」（受到挫折越發振作勇敢）。干擾項「自暴自棄」和「一蹶不振」都是失敗後灰心喪志，與「反而更加努力」語意矛盾；「得意忘形」指得意時失態，與「失利」的情境不合。故選「愈挫愈勇」。' },
        { diff: 'challenge', q: '下列文句與其所屬修辭的配對，何者正確？', options: ['「他的聲音像洪鐘一樣響亮」——誇飾', '「春天來了，小草偷偷地從土裡鑽出來」——擬人', '「我餓得可以吃下一頭牛」——譬喻', '「光陰似箭，歲月如梭」——借代'], answer: [1], explain: '只有「春天來了，小草偷偷地從土裡鑽出來」配對正確：把小草寫成會「偷偷地」動作、主動「鑽」出泥土的人，屬擬人。干擾項均錯：「像洪鐘一樣響亮」有「像」作比方，是譬喻而非誇飾；「餓得可以吃下一頭牛」是誇大程度的誇飾，不是譬喻；「光陰似箭，歲月如梭」有「似」「如」，是用他物作比方的譬喻，並非以相關事物代替本體的借代。故選第二項。' },
    ],
    'chinese|8|tf': [
        { diff: 'pro', q: '「不入虎穴，焉得虎子」中的「焉」字，在此句中的意思相當於「怎麼」。', options: ['是', '非'], answer: [0], explain: '正確。「焉得」是文言常見的疑問用法，「焉」在此為疑問副詞，意即「怎麼、哪裡」，全句是說「不進入老虎洞，怎麼能得到小老虎」，比喻不冒險犯難就難以成功。主要干擾在於「焉」另有「於是、於此」的用法（如「三人行，必有我師焉」的「焉」是「於此」），容易讓人誤判此句的「焉」也是該義；但本句明顯是反詰疑問，「焉」須解作「怎麼」。本題需先辨識句型、再判別虛詞義項，屬兩步推理，故為 pro。' },
        { diff: 'pro', q: '李白〈秋浦歌〉「白髮三千丈，緣愁似箇長」用「三千丈」來寫白髮，是運用「誇飾」修辭。', options: ['是', '非'], answer: [0], explain: '正確。頭髮再長也不可能真有三千丈，詩人刻意誇大長度，用來凸顯愁緒的深長，正是「誇飾」（誇張）修辭的手法。主要干擾是把「似箇長」中的「似」誤讀為譬喻，因而認為本句是譬喻而非誇飾；但「似箇」是「像這樣」，「緣愁似箇長」是說「因為愁而變得這樣長」，全句重點仍是以誇張的數字表現愁，故仍屬誇飾。判斷此句須先理解詩意、再排除譬喻的干擾，屬兩步推理，故為 pro。' },
    ],
    'english|4|multiple': [
        { diff: 'basic', q: 'Select all the greetings you say when you MEET someone.', options: ['Good morning!', 'Goodbye!', 'Hi!', 'Hello!'], answer: [0, 2, 3], explain: '\'Good morning!\', \'Hi!\' and \'Hello!\' are all greetings used when you meet a person. The main distractor \'Goodbye!\' is wrong because it is said when you leave, not when you meet someone.' },
        { diff: 'basic', q: 'Select all the numbers that are bigger than seven.', options: ['eight', 'nine', 'ten', 'six'], answer: [0, 1, 2], explain: 'Eight (8), nine (9) and ten (10) are all bigger than seven. The distractor \'six\' is wrong because 6 is smaller than 7.' },
        { diff: 'basic', q: 'Someone asks you \'How old are you?\' Select all the correct answers.', options: ['I am eight years old.', 'I am eight.', 'I have eight years.', 'Eight.'], answer: [0, 1, 3], explain: 'In English we talk about age with \'be\', so \'I am eight (years old)\' and the short answer \'Eight.\' are correct. The distractor \'I have eight years.\' is wrong because English does not use \'have\' to say how old you are (that is a common Chinese-to-English mistake).' },
        { diff: 'pro', q: 'Select all the sentences that tell what someone is doing RIGHT NOW.', options: ['She is reading a book.', 'They are playing soccer.', 'He goes to school every day.', 'I am eating lunch.'], answer: [0, 1, 3], explain: 'These three use am/is/are + V-ing to show an action happening at this moment. The distractor \'He goes to school every day\' is wrong because it uses the simple present to describe a habit, not something happening right now.' },
        { diff: 'pro', q: 'Select all the sentences that use the correct verb form.', options: ['She likes apples.', 'He go to the park.', 'My brother plays the piano.', 'They watches TV.'], answer: [0, 2], explain: 'With he, she or it (one person or thing), the verb takes -s: \'She likes\' and \'My brother plays\' are correct. The distractors \'He go to the park\' and \'They watches TV\' are wrong: \'he\' needs \'goes\', and \'they\' needs \'watch\' without -s.' },
    ],
    'english|4|single': [
        { diff: 'basic', q: 'It is 8 o\'clock in the morning. You meet your teacher at school. What do you say?', options: ['Good morning!', 'Good night!', 'Good afternoon!', 'Good evening!'], answer: [0], explain: '正確答案是 Good morning!——早上（中午 12 點前）見面時的問候語。主要干擾項 Good night! 是「晚安」，用於晚上道別或睡前，不是早上見面說的；Good afternoon 是下午見面用，Good evening 是傍晚／晚上見面用，時間都不對。' },
        { diff: 'basic', q: 'Which one is a drink?', options: ['milk', 'rice', 'bread', 'cake'], answer: [0], explain: '正確答案是 milk（牛奶），它是飲料。主要干擾項 rice（飯）、bread（麵包）、cake（蛋糕）都是食物（food），不是用喝的飲料，因此不符合題目問的 drink。' },
        { diff: 'pro', q: 'Tom is older than Jack. Jack is older than Ben. Who is the youngest?', options: ['Ben', 'Jack', 'Tom', 'Amy'], answer: [0], explain: '需要把兩句話串起來推理：Tom 比 Jack 大，Jack 又比 Ben 大，所以年齡順序是 Tom > Jack > Ben，最小的是 Ben。主要干擾項 Jack 是中間那個（只比 Tom 小），Tom 反而是最大的；Amy 則完全沒出現在句子裡，是無關的干擾項。' },
    ],
    'english|4|tf': [
        { diff: 'basic', q: 'In English, we say "Good morning" to greet someone in the morning.', options: ['是', '非'], answer: [0], explain: '正確（是）。"Good morning" 是英文早上見面時的招呼語，用於問候，國小中年級課本裡的 Greetings 單元一定會教。選「非」的干擾點在於把招呼語和道別語混在一起："Good night" 是晚上要離開或睡前說的道別語，不是用來跟人道早上的招呼，所以這題不能選「非」。' },
        { diff: 'pro', q: 'In the sentence "I go to school by bus," the word "by" tells us how the speaker goes to school.', options: ['是', '非'], answer: [0], explain: '正確（是）。這題要先把句子拆成「主詞 I / 動作 go / 方式 by bus」，再判斷 by 的功能：by + 交通工具（by bus、by bike、by train）表示「搭乘某種交通工具」的方法，所以 by 正是在說明「怎麼去」。要選對得先辨認 by bus 是一個片語、再理解它回答的是 how，這是兩步推理。選「非」的主要干擾來自分不清 by 的用法：by 也可以表示「在……旁邊」（如 by the door），但在這個句子裡後面接的是交通工具，講的是方式而不是位置，所以不能因為 by 有其他意思就判它無關。' },
    ],
    'english|6|multiple': [
        { diff: 'basic', q: 'Which of these numbers are between ten and twenty?', options: ['twelve', 'seven', 'fifteen', 'thirty'], answer: [0, 2], explain: 'Twelve (12) and fifteen (15) are between 10 and 20. \'Seven\' (7) is below ten and \'thirty\' (30) is above twenty, so each is a wrong-range distractor.' },
        { diff: 'basic', q: 'It is 3:30 now. Which TWO ways can you correctly say this time?', options: ['three thirty', 'half past three', 'three o\'clock', 'thirty past three'], answer: [0, 1], explain: '3:30 is said \'three thirty\' or \'half past three\'. The distractor \'three o\'clock\' means exactly 3:00, and \'thirty past three\' is not a real English pattern (English uses \'half past\' or \'three thirty\').' },
        { diff: 'basic', q: 'Which months come after June in the same year?', options: ['August', 'May', 'September', 'April'], answer: [0, 2], explain: 'The months after June are July through December; of the options only August and September do. \'May\' and \'April\' come before June, so they are the distractors.' },
        { diff: 'pro', q: 'Which sentences describe a daily habit or routine?', options: ['I get up at six every day.', 'She walks to school every morning.', 'They are watching TV now.', 'He usually does his homework after dinner.'], answer: [0, 1, 3], explain: 'Simple present together with time words like \'every day\', \'every morning\' and \'usually\' talks about habits. The distractor \'They are watching TV now\' is present continuous and only describes an action happening at this moment, not a routine.' },
        { diff: 'pro', q: 'Tom is 150 cm tall. Ben is 140 cm tall. Which sentences are true?', options: ['Tom is taller than Ben.', 'Ben is taller than Tom.', 'Ben is shorter than Tom.', 'Tom is shorter than Ben.'], answer: [0, 2], explain: 'Tom (150 cm) is taller than Ben (140 cm), so \'Tom is taller than Ben\' and \'Ben is shorter than Tom\' are both true. The other two swap the names and state the opposite, which is false.' },
        { diff: 'pro', q: 'Read: "Amy is from Canada. She speaks English and French." Which sentences are correct?', options: ['Amy comes from Canada.', 'Amy can speak two languages.', 'Amy is from France.', 'Amy speaks English.'], answer: [0, 1, 3], explain: '\'From Canada\' means she comes from Canada; English and French are two languages, so she can speak two languages and she speaks English. The distractor \'Amy is from France\' is wrong: Canada and France are different countries, and the text says Canada.' },
    ],
    'english|6|single': [
        { diff: 'basic', q: 'Choose the correct word: "____ are my new shoes."', options: ['These', 'This', 'That', 'It'], answer: [0], explain: 'The noun "shoes" is plural, so the plural demonstrative "These" is correct. "This" and "That" point to a single thing, and "It" is a singular pronoun, so none of them can agree with the plural "shoes".' },
        { diff: 'basic', q: 'Choose the correct word: "There is a picture ____ the wall."', options: ['on', 'in', 'at', 'of'], answer: [0], explain: 'We use "on" for something attached to a surface, so "on the wall" is correct. The main distractor "in" would mean the picture is inside the wall itself, and "at" and "of" do not express position on a surface here.' },
        { diff: 'pro', q: 'Choose the correct words: "Every morning Tom ____ to school, but today he ____ a bus."', options: ['walks / is taking', 'walk / takes', 'is walking / takes', 'walks / takes'], answer: [0], explain: 'The first clause describes a daily habit ("every morning"), so the present simple "walks" is needed; the second clause describes what is happening today/now, so the present continuous "is taking" is needed. The tempting distractor "walks / takes" is wrong because it uses the simple present for both, missing the habit-vs-now contrast.' },
        { diff: 'pro', q: 'Amy is 150 cm tall. Ben is 155 cm tall. Which sentence is correct?', options: ['Ben is taller than Amy.', 'Amy is taller than Ben.', 'Ben is the tallest of the two.', 'Amy is as tall as Ben.'], answer: [0], explain: 'Ben (155 cm) is taller than Amy (150 cm), so "Ben is taller than Amy" is correct. The key distractor "Ben is the tallest of the two" is wrong because the superlative "the tallest" is not used when comparing only two people; we use the comparative "taller".' },
    ],
    'english|6|tf': [
        { diff: 'basic', q: 'In English, the word "breakfast" means the first meal of the day.', options: ['是', '非'], answer: [0], explain: '正確（答「是」）。"breakfast" 專指一天當中的第一餐，也就是早餐，是台灣國小高年級英語課程常見的生活字彙。主要干擾項：若把 breakfast 誤記成午餐，就會答「非」——但午餐是 "lunch"，早餐才是 "breakfast"，兩者不可混淆。' },
        { diff: 'pro', q: 'In English, the past tense of the verb "go" is "goed", formed by adding -ed like a regular verb.', options: ['是', '非'], answer: [1], explain: '答「非」。"go" 是不規則動詞（irregular verb），過去式是 "went"，並非 "goed"。主要干擾項：本題刻意套用規則動詞加 -ed 的變化（如 walk→walked）來誤導，若只背了「動詞過去式加 -ed」的通則而沒有掌握不規則動詞，就會誤答「是」。要判斷正確，需先知道 -ed 是規則變化，再回想 go 屬於不規則動詞、其過去式另有形式，屬兩步推理。' },
    ],
    'english|8|multiple': [
        { diff: 'basic', q: 'Select all the POSSESSIVE ADJECTIVES.', options: ['my', 'your', 'he', 'their'], answer: [0, 1, 3], explain: '\'My\', \'your\', and \'their\' are possessive adjectives because they come before a noun and show who owns it (my bag, your book, their school). \'He\' is a subject pronoun, not a possessive adjective — the possessive form is \'his\'.' },
        { diff: 'basic', q: 'Select all the words that are FAMILY members.', options: ['uncle', 'cousin', 'doctor', 'aunt'], answer: [0, 1, 3], explain: '\'Uncle\', \'cousin\', and \'aunt\' are all family members. \'Doctor\' is a job/profession, not a family relationship, so it is the distractor.' },
        { diff: 'pro', q: 'Select all the sentences that use the COMPARATIVE form correctly.', options: ['This book is more interesting than that one.', 'She is taller than her sister.', 'He is more taller than me.', 'Today is more hot than yesterday.'], answer: [0, 1], explain: 'Long adjectives take \'more\' + adjective (\'more interesting\'), and short one-syllable adjectives take -er (\'taller\'), so sentences 1 and 2 are correct. Sentence 3 uses a double comparative (\'more taller\'); it should be just \'taller\' or \'more tall\' is never correct either — only one comparative marker is allowed. Sentence 4 is wrong because a one-syllable adjective like \'hot\' takes -er, giving \'hotter\', not \'more hot\'.' },
        { diff: 'pro', q: 'Select all the sentences that use \'for\' or \'since\' correctly with the present perfect.', options: ['I have lived here for five years.', 'She has been sick since Monday.', 'We have known each other since ten years.', 'He has worked there for a long time.'], answer: [0, 1, 3], explain: '\'For\' is used with a length of time (for five years, for a long time) and \'since\' with a specific starting point (since Monday). Sentences 1, 2, and 4 follow this rule. Sentence 3 is wrong because \'ten years\' is a duration, so it must take \'for\' (for ten years), not \'since\'.' },
        { diff: 'pro', q: 'Select all the sentences with correct SUBJECT-VERB AGREEMENT.', options: ['The news is surprising.', 'Each of the students has a book.', 'My glasses is new.', 'The police are coming.'], answer: [0, 1, 3], explain: '\'News\' is an uncountable noun treated as singular (\'is\'), \'each\' takes a singular verb (\'has\'), and \'police\' is always plural (\'are\'), so sentences 1, 2, and 4 are correct. Sentence 3 is wrong because \'glasses\' (a pair of eyeglasses) is plural and needs \'are\', not \'is\'.' },
        { diff: 'challenge', q: 'Select all the sentences where the DIRECT speech has been changed to REPORTED speech correctly.', options: ['He said, "I am tired." → He said that he was tired.', 'She said, "I will come." → She said that she would come.', 'They said, "We are late." → They said that they are late.', 'Tom said, "I can swim." → Tom said that he could swim.'], answer: [0, 1, 3], explain: 'Reported speech shifts the tense one step back and changes pronouns: present \'am\' → \'was\' (sentence 1), \'will\' → \'would\' (sentence 2), and \'can\' → \'could\' (sentence 4), so these three are correct. Sentence 3 fails to backshift — the present \'are\' must become the past \'were\', giving \'They said that they were late\'.' },
    ],
    'english|8|single': [
        { diff: 'basic', q: 'Which word is a fruit?', options: ['carrot', 'apple', 'chair', 'pencil'], answer: [1], explain: 'Apple 是水果 (fruit)。carrot 是蔬菜 (vegetable)，chair 是家具，pencil 是文具。主要干擾項 carrot 因為也是「吃的东西」容易被誤選。' },
        { diff: 'basic', q: 'Choose the correct word: "I go to school ___ bus every morning."', options: ['on', 'with', 'by', 'in'], answer: [2], explain: 'by bus 是固定用法（by + 交通工具，不加冠詞），表示「搭公車」。主要干擾項 on 只用在 on foot 或 on the bus（需加冠詞 the）時，句中沒有冠詞故不對；with 通常指「和某人一起」，in 用於 in a car 這類需冠詞的搭配。' },
        { diff: 'pro', q: 'A: Where is Tom?\nB: He ___ to the library. He will be back at five.', options: ['has gone', 'has been', 'went', 'is going'], answer: [0], explain: 'has gone to 表示「人已經去了某地、現在不在這裡」，正好解釋為何找不到 Tom。主要干擾項 has been to 表示「曾經去過」（人已回來），與「現在不在」矛盾；went 是過去式，需要明確過去時間且無法說明現況；is going 是「正在前往」，與 will be back at five 的語境不合。' },
        { diff: 'pro', q: 'She decided ___ a new bike with her pocket money.', options: ['buying', 'buy', 'bought', 'to buy'], answer: [3], explain: '動詞 decide 後面要接 to + 原形動詞（decide to do something）。主要干擾項 buying 是動名詞，decide 不接 V-ing；buy 與 bought 都缺少 to，語法錯誤。' },
        { diff: 'pro', q: 'The window ___ by the boy yesterday afternoon.', options: ['broke', 'was broken', 'is broken', 'breaks'], answer: [1], explain: '主詞 the window 是「被打破」的，且時間是過去 (yesterday afternoon)，需用過去被動 was + 過去分詞 broken。主要干擾項 broke 是主動過去式，窗戶不會自己打破；is broken 是現在被動，時態與過去時間不符；breaks 是現在式。' },
        { diff: 'challenge', q: 'Neither the teacher nor the students ___ happy with the new schedule.', options: ['are', 'is', 'was', 'be'], answer: [0], explain: 'neither A nor B 的動詞要與「最靠近的主詞」一致（就近原則 proximity rule）。最靠近的是複數 the students，故用複數 are。主要干擾項 is / was 是單數，誤以為要跟前面的 the teacher 一致（這是本題設的陷阱）；be 是原形，不能單獨當主要動詞。本題同時考連接詞 neither...nor 與主謂一致兩個概念。' },
    ],
    'english|8|tf': [
        { diff: 'pro', q: 'In the sentence "The box is too heavy for me to carry," the speaker means that they are able to carry the box.', options: ['是', '非'], answer: [1], explain: 'The pattern too + adjective + to V means "so ... that one cannot V" (太…以致於不能…). So "too heavy for me to carry" means the speaker CANNOT carry it — the sentence expresses inability, not ability. Main distractor: students read "for me to carry" literally as "for me to carry it" and assume it means ability; the word "too" flips the meaning to negative.' },
        { diff: 'pro', q: '"May I borrow your umbrella?" and "Could you lend me your umbrella?" can both be used to ask for the same thing.', options: ['是', '非'], answer: [0], explain: 'borrow means 借入 (the subject receives the thing) and lend means 借出 (the subject gives it). In the first sentence "I" borrow from you; in the second "you" lend to me — in both cases the umbrella ends up with the speaker, so they are the same request from different angles. Main distractor: learners treat borrow and lend as exact synonyms, but they are used on opposite sides (I borrow / you lend), so you cannot simply swap them in one sentence.' },
    ],
    'science|4|multiple': [
        { diff: 'basic', q: '下列哪些是綠豆種子發芽時一定要具備的條件？（可多選）', options: ['水分', '空氣', '土壤', '適宜的溫度'], answer: [0, 1, 3], explain: '綠豆等種子發芽需要水分、空氣（氧氣）與適宜的溫度。土壤不是必要條件，把種子放在濕棉花或濕紙巾上也能發芽，所以「土壤」是設計好的干擾項。' },
        { diff: 'basic', q: '下列哪些物體本身會發光，可以當作光源？（可多選）', options: ['太陽', '點亮的電燈', '月亮', '螢火蟲'], answer: [0, 1, 3], explain: '光源是指自己能發光的物體，太陽、點亮的電燈與螢火蟲都會自行發光。月亮只是反射太陽的光、本身不會發光，是常見的干擾項。' },
        { diff: 'basic', q: '下列哪些動物的寶寶是喝媽媽的奶長大的（哺乳類）？（可多選）', options: ['狗', '雞', '貓', '鯨魚'], answer: [0, 2, 3], explain: '狗、貓與鯨魚都是哺乳類，會以母乳哺育幼獸；鯨魚雖然住在海裡，仍然是哺乳類。雞是卵生、由蛋孵出小雞，屬於鳥類，是這題的干擾項。' },
        { diff: 'pro', q: '把一盆綠色植物放進完全沒有光的黑暗箱子裡，過了一天，下列哪些敘述是正確的？（可多選）', options: ['植物無法進行光合作用', '植物仍會進行呼吸作用', '植物還是能製造大量的養分', '植物會吸收氧氣、放出二氧化碳'], answer: [0, 1, 3], explain: '光合作用需要光，黑暗中植物無法行光合作用，因此也無法製造養分；但呼吸作用日夜都進行，會吸收氧氣、放出二氧化碳。選項「植物還是能製造大量的養分」忽略了光合作用必須有光，是主要干擾項。' },
        { diff: 'pro', q: '下列哪些現象的形成和水蒸氣「遇冷凝結」有關？（可多選）', options: ['冰飲料杯外壁出現小水珠', '清晨草地上出現露水', '冬天從嘴巴呵氣冒出白霧', '冰塊放在室溫下變成水'], answer: [0, 1, 2], explain: '杯壁上的小水珠、清晨的露水與呵氣冒出的白霧，都是空氣中的水蒸氣遇冷凝結成小水滴的現象。冰塊在室溫下變成水是固體熔化成液體（熔化），方向和水蒸氣變水不同，不是凝結，是這題的干擾項。' },
    ],
    'science|4|single': [
        { diff: 'basic', q: '植物的根最主要的功能是什麼？', options: ['行光合作用製造養分', '吸收水分和養分', '支撐整棵植物讓它站直', '散發香味吸引昆蟲'], answer: [1], explain: '正確答案是「吸收水分和養分」：根長在土裡，負責把水和溶解在水中的養分吸進植物體。干擾項「行光合作用製造養分」是葉片的功能，「支撐整棵植物」主要是莖的功能，「散發香味吸引昆蟲」是花的功能，三者都是植物其他部位的工作，不能選。' },
        { diff: 'basic', q: '把食鹽放進裝水的杯子裡攪拌後，食鹽慢慢看不見了，這種現象叫做什麼？', options: ['熔化', '蒸發', '溶解', '凝結'], answer: [2], explain: '正確答案是「溶解」：食鹽在水中散開、均勻混入水中而看不見，就是溶解。干擾項「熔化」是固體受熱變成液體（如冰變水），「蒸發」是液體變成氣體（如水變水蒸氣），「凝結」是氣體變成液體，三者都是物質三態的改變，跟泡在水裡散開的現象不同。' },
        { diff: 'pro', q: '小華把一杯水放在窗邊，幾天後發現杯子裡的水變少了。水主要是跑到哪裡去了？', options: ['水滲進玻璃杯的杯壁裡', '水結成冰塊留在杯底', '水蒸發變成水蒸氣散到空氣中', '水被陽光分解成新的物質'], answer: [2], explain: '正確答案是「水蒸發變成水蒸氣散到空氣中」：水在常溫下也會慢慢蒸發成水蒸氣，飄散到空氣裡，所以杯中的水看起來變少了。干擾項「滲進杯壁」不合理，玻璃杯裝水不會吸水；「結成冰塊」需要低溫，放在窗邊反而受熱；「被陽光分解成新物質」是把水誤認成會變成別種物質，實際上蒸發只是水從液體變成氣體，還是水。' },
    ],
    'science|4|tf': [
        { diff: 'basic', q: '所有昆蟲都有 8 隻腳。', options: ['是', '非'], answer: [1], explain: '正確答案是「非」。昆蟲的成蟲都有 6 隻腳（也就是 3 對腳），8 隻腳是蜘蛛等其他節肢動物的特徵，不是昆蟲。主要干擾點在於：許多人一看到小型的蟲子就都叫牠「昆蟲」，容易把有 8 隻腳的蜘蛛也算進去，所以這句話是錯的。' },
        { diff: 'pro', q: '把一個空玻璃杯倒扣後垂直壓入水中，杯內的水幾乎不會上升，這表示空氣占有空間。', options: ['是', '非'], answer: [0], explain: '正確答案是「是」。杯子裡雖然看起來是空的，其實充滿了空氣；倒扣壓入水中時，杯內的空氣占住空間、阻擋水進入，所以水幾乎升不上去，這說明空氣占有空間。主要干擾點在於：因為杯子「看起來是空的」，容易誤以為裡面什麼都沒有，水應該會把整個杯子灌滿，但實際上水只能升到一小段高度。' },
    ],
    'science|6|multiple': [
        { diff: 'basic', q: '下列哪些是水從一種狀態變成另一種狀態（狀態改變）的現象？（可多選）', options: ['冰塊放在室溫下融化成水', '水蒸氣遇到冰冷的玻璃變成小水滴', '水放進冷凍庫結成冰', '石頭長時間被風吹日曬變成小石塊'], answer: [0, 1, 2], explain: '冰→水是融化、水蒸氣→水是凝結、水→冰是凝固，都屬於水的狀態改變。石頭被風吹日曬變成小石塊是風化作用，屬於岩石被破壞，和水變成另一種狀態無關，是干擾項。' },
        { diff: 'basic', q: '把下列哪些物質放入水中攪拌後會「溶解」而看不見？（可多選）', options: ['砂糖', '食鹽', '沙子', '味精'], answer: [0, 1, 3], explain: '砂糖、食鹽、味精都會均勻溶解在水中而看不見顆粒，這叫溶解。沙子不會溶解，攪拌後仍然沉在水底、看得到，所以不選沙子這個干擾項。' },
        { diff: 'basic', q: '下列哪些動物屬於「哺乳類」？（可多選）', options: ['蝙蝠', '鯨魚', '企鵝', '狗'], answer: [0, 1, 3], explain: '蝙蝠、鯨魚、狗都是胎生、用母體乳汁哺育幼兒的哺乳類，蝙蝠會飛、鯨魚住海裡只是牠們的生活方式，不改變分類。企鵝是鳥類，卵生、身上有羽毛，不是哺乳類，是干擾項。' },
        { diff: 'pro', q: '想把一杯熱水保溫、讓它降溫慢一點，下列哪些做法有幫助？（可多選）', options: ['把熱水倒進保溫瓶裡', '在杯子外面包上毛巾', '把杯子放在電風扇前面吹風', '替杯子蓋上蓋子'], answer: [0, 1, 3], explain: '保溫瓶和毛巾可減少熱的傳導，蓋上蓋子可減少熱隨水蒸氣散失、也減少空氣對流帶走熱，三者都能減緩散熱。放在電風扇前吹風會加速空氣流動帶走熱，反而使熱水降溫更快，是干擾項（做法和保溫剛好相反）。' },
        { diff: 'pro', q: '把下列物體放入水中，哪些會浮在水面上？（可多選）', options: ['木頭', '鐵釘', '保麗龍球', '石頭'], answer: [0, 2], explain: '物體密度比水小就會浮起來：木頭和保麗龍球的密度比水小，所以浮在水面。鐵釘、石頭的密度比水大，會沉到水底，這兩個是干擾項。要注意物體浮沉看的是密度，不是體積大小。' },
        { diff: 'pro', q: '烤肉時想讓木炭燒得更旺盛，下列哪些做法有幫助？（可多選）', options: ['用扇子搧風', '讓木炭之間留有空隙', '用鍋蓋把木炭整個蓋住', '先把木炭泡水再拿去烤'], answer: [0, 1], explain: '燃燒需要氧氣：搧風和讓木炭間留空隙都能增加氧氣供應，使木炭燒得更旺。用鍋蓋蓋住會使氧氣不足，燃燒減弱甚至熄滅；先把木炭泡水則因水分太多、不易點燃，兩者都是干擾項。' },
    ],
    'science|6|single': [
        { diff: 'basic', q: '下列哪一種物品最容易被磁鐵吸引？', options: ['銅板', '鋁箔紙', '鐵釘', '橡皮擦'], answer: [2], explain: '磁鐵會吸引鐵、鈷、鎳等材質，鐵釘是鐵製品，最容易被磁鐵吸引。銅板和鋁箔紙雖然也是金屬，但不會被磁鐵吸引，這是最常見的干擾點；橡皮擦不是金屬，同樣不會被吸引。' },
        { diff: 'basic', q: '植物主要用哪一個部位吸收水分和礦物質？', options: ['葉', '根', '花', '果實'], answer: [1], explain: '根除了把植物固定在土壤裡，還負責吸收生長所需的水分和礦物質。葉主要行光合作用、蒸散水分，花和果實與繁殖有關，都不是吸收水分的主要部位。' },
        { diff: 'pro', q: '同一塊鐵做成實心的鐵塊會沉入水中，做成中空的鐵船卻能浮在水面上，主要原因為何？', options: ['船有螺旋槳往下方推水，所以能浮起來', '鐵做成船之後就變成不會下沉的金屬', '船身中空、體積變大，能排開更多的水，浮力也變大', '船會移動，移動中的物體都不會下沉'], answer: [2], explain: '物體在水中的浮力大小和它排開的水量有關。鐵做成中空船身時體積變大，能排開更多的水，浮力大到足以支撐船的重量，所以能浮起來。螺旋槳只提供前進的推力，與浮沉無關；鐵的性質不會因為做成船就改變，這是最常見的錯誤想法。' },
        { diff: 'pro', q: '夏天用保麗龍盒裝冰塊，冰塊融化得比直接放在桌上慢，最主要的原因是什麼？', options: ['保麗龍會自己製造冷氣，讓冰塊降溫', '保麗龍不易導熱，能減緩外面的熱傳進盒內', '保麗龍本身的溫度比冰塊還低', '保麗龍會把冰塊的熱吸走'], answer: [1], explain: '保麗龍內部充滿空氣、不容易導熱，是良好的絕熱材料，能減少外面熱空氣的熱量傳進盒內，冰塊因此融得比較慢。它不會自己製冷、溫度也不比冰塊低，更不是把熱「吸走」，這些都是常見的迷思。' },
    ],
    'science|6|tf': [
        { diff: 'basic', q: '昆蟲的身體可以分成頭、胸、腹三個部分，而且胸部有六隻腳。', options: ['是', '非'], answer: [0], explain: '正確。昆蟲的身體分成頭、胸、腹三部分，成蟲在胸部有六隻腳，這是辨認昆蟲最基本的特徵。主要干擾項是「非」：學生常把蜘蛛、蜈蚣也當成昆蟲，但蜘蛛有八隻腳、身體只分兩部分，不屬於昆蟲；本題敘述的正是昆蟲真正具備的特徵，所以答案為「是」。' },
        { diff: 'pro', q: '把砂糖加入水中攪拌後，砂糖會消失不見，所以糖水的總重量會比原來的水和砂糖的總重量還要輕。', options: ['是', '非'], answer: [1], explain: '錯誤。砂糖只是溶解在水中、變成看不到的顆粒均勻分散，並沒有消失，物質的總質量不會改變，所以糖水的重量等於原來的水加砂糖的總重。主要干擾項是「是」：學生看到砂糖「不見了」，容易誤以為物質消失了而重量變輕；其實溶解後糖仍留在水裡。可從糖水嘗起來有甜味、加熱蒸發後又能取回砂糖來驗證糖並沒有消失。' },
    ],
    'science|8|multiple': [
        { diff: 'basic', q: '下列哪些是國中自然課本中介紹的「熱的傳播方式」？（可多選）', options: ['傳導', '對流', '輻射', '反射'], answer: [0, 1, 2], explain: '熱的傳播方式有三種：傳導（固體中粒子直接傳遞熱能）、對流（液體或氣體因密度差而流動傳熱）、輻射（不需介質，以電磁波傳熱）。「反射」是光遇到界面改變行進方向的現象，屬於光的性質，不是熱的傳播方式，是本題最主要的干擾項，學生常把「輻射」與「反射」混淆。' },
        { diff: 'basic', q: '下列哪些生物的生殖方式屬於「無性生殖」？（可多選）', options: ['細菌的分裂生殖', '酵母菌的出芽生殖', '蕨類以孢子繁殖', '被子植物以花粉與胚珠受精'], answer: [0, 1, 2], explain: '無性生殖不經過雌雄配子結合，只由單一親代產生子代，子代性狀與親代幾乎相同；細菌分裂、酵母菌出芽、蕨類以孢子繁殖都符合這個定義。花粉與胚珠的受精涉及雌雄配子結合，屬於有性生殖，故不是無性生殖，這是最常見的混淆項。' },
        { diff: 'pro', q: '下列哪些現象主要是由「光的折射」造成的？（可多選）', options: ['筷子斜插入水中，看起來好像折斷了', '游泳池看起來比實際深度淺', '在平面鏡中看到自己的臉', '陽光下物體形成影子'], answer: [0, 1], explain: '光從水進入空氣（或由空氣進入水）時，因傳播速度改變而在界面偏折，稱為折射；筷子看起來折斷、池水看起來變淺，都是折射造成的視覺位置改變。平面鏡成像屬於光的反射，影子則是光沿直線前進被物體擋住所形成，兩者都與折射無關，是本題的主要干擾項。' },
        { diff: 'pro', q: '關於物體在水中所受的浮力，下列哪些敘述正確？（可多選）', options: ['浮力的方向恆為向上', '物體排開的水越多，所受浮力越大', '密度比水大的物體放入水中會下沉', '浮力大小與物體浸在水中的深度成正比'], answer: [0, 1, 2], explain: '浮力來自在水中各深度的壓力差，方向恆向上；依阿基米德原理，浮力等於物體排開液體的重量，排開越多浮力越大；密度大於水的物體，浮力不足以支撐其重量，因此下沉。浮力只與排開液體的體積（重量）有關，完全浸沒後再加深也不會改變，故「與深度成正比」是錯誤的干擾項。' },
        { diff: 'pro', q: '關於酸與鹼的中和反應，下列哪些敘述正確？（可多選）', options: ['鹽酸與氫氧化鈉反應會生成鹽類和水', '酸鹼恰好完全中和時，溶液的pH值接近7', '中和反應會放出熱，使溶液溫度上升', '酸與鹼混合後仍各自保持原來的酸性與鹼性'], answer: [0, 1, 2], explain: '酸與鹼反應生成鹽類和水，這種反應稱為中和；當酸鹼恰好完全反應時，溶液呈中性、pH值接近7；中和是放熱反應，溶液溫度會上升。酸鹼混合後會互相反應而改變原本的性質，不會各自保持原來的酸性與鹼性，故最後一項為錯誤的干擾項。' },
        { diff: 'challenge', q: '關於遺傳與演化，下列哪些敘述正確？（可多選）', options: ['基因位於染色體上，是控制性狀的基本單位', '一對等位基因中，顯性者會表現出來而掩蓋隱性者', '天擇的前提是族群中先存在可遺傳的變異', '生物後天鍛鍊出的性狀一定會遺傳給下一代'], answer: [0, 1, 2], explain: '此題整合遺傳與演化兩個概念：基因位於染色體上並控制性狀；一對等位基因中顯性者會表現、隱性者被掩蓋；達爾文的天擇說強調族群內先有可遺傳的變異，環境再篩選出適應者，經世代累積造成演化。後天鍛鍊（如肌肉變壯）不會改變生殖細胞內的基因，因此不會遺傳，這是拉馬克「用進廢退」的錯誤觀念，也是本題最主要的干擾項。' },
    ],
    'science|8|single': [
        { diff: 'basic', q: '使用複式顯微鏡觀察玻片標本時，如果要讓視野中的影像變亮，應該調整下列哪一項？', options: ['轉動粗調節輪', '調整光圈大小（或轉動反光鏡）', '更換放大倍率更高的物鏡', '左右移動玻片標本'], answer: [1], explain: '視野的亮度由進入鏡筒的光量決定，調整光圈或轉動反光鏡可直接增減進光量。轉動粗調節輪是為了對焦讓影像清晰，不是調亮度；更換高倍物鏡只會改變放大倍率（通常還更暗）；移動玻片只是改變觀察的位置，都不會讓影像變亮。' },
        { diff: 'basic', q: '下列哪一種水溶液呈酸性？', options: ['肥皂水', '氫氧化鈉溶液', '檸檬汁', '食鹽水'], answer: [2], explain: '檸檬汁含有檸檬酸，呈酸性，能使藍色石蕊試紙變紅。肥皂水與氫氧化鈉溶液都呈鹼性，食鹽水接近中性；三者都不是酸性，是常見的干擾選項。' },
        { diff: 'pro', q: '公車突然煞車時，站著的乘客身體會向前傾，主要原因是什麼？', options: ['乘客受到一股向前的推力', '地板與鞋子之間的摩擦力', '乘客身體具有慣性，傾向維持原來的運動狀態', '地球引力突然變大'], answer: [2], explain: '煞車時腳（與地板接觸）隨車減速，但上半身因慣性仍想維持原本向前的運動狀態，於是相對車身前傾。主要干擾項「受到一股向前的推力」是錯誤的：並沒有一個向前的力推乘客，實際上使腳減速的是向後的摩擦力；把慣性現象誤解成多出一個力，是常見的錯誤。' },
        { diff: 'pro', q: '將水通電進行電解時，在負極產生的氫氣與在正極產生的氧氣，其體積比約為多少？', options: ['1：1', '1：2', '2：1', '3：1'], answer: [2], explain: '水的化學式為 H₂O，氫、氧原子數比為 2：1，電解後同溫同壓下氣體體積比也約為 2：1，即負極氫氣、正極氧氣約為 2：1。干擾項「1：2」是把氫氣與氧氣的位置對調，須分辨清負極產生的是氫氣。' },
        { diff: 'pro', q: '在食物鏈中，能量由一個營養階層傳遞到下一階層時，大部分能量以下列哪一種形式散失？', options: ['光能', '化學能', '聲能', '熱能'], answer: [3], explain: '生物行呼吸作用取得能量後，大部分（約九成）以熱能的形式散失到環境中，只有約一成能傳給下一營養階層，所以能量會逐層遞減而不會循環。干擾項「化學能」是能量儲存在生物體內的養分形式，並不是散失到環境的主要形式。' },
        { diff: 'challenge', q: '將兩顆相同的燈泡原本串聯接在一個電池上，改接成並聯後仍接在同一個電池上，下列敘述何者正確？', options: ['串聯時每顆燈泡較亮，電池供應的總電流較大', '並聯時每顆燈泡較亮，電池供應的總電流較大', '兩種接法每顆燈泡的亮度相同', '並聯時每顆燈泡較暗，電池供應的總電流較小'], answer: [1], explain: '串聯時電壓由兩顆燈泡分掉，每顆只分到部分電壓而較暗；改成並聯後每顆燈泡各自承受接近電池的電壓，因此較亮，且兩顆同時取用電流，電池供應的總電流也較大。干擾項「串聯較亮」錯在忽略串聯的分壓效果；「兩種接法亮度相同」則忽略了接法會改變每顆燈泡分到的電壓。' },
    ],
    'science|8|tf': [
        { diff: 'pro', q: '公車突然起步向前加速時，站著的乘客身體會向後傾，這是因為乘客具有慣性。', options: ['是', '非'], answer: [0], explain: '正確（是）。乘客原本隨車靜止，公車向前加速時，乘客因為慣性想保持原來的靜止狀態，所以身體相對車廂向後傾。慣性是物體保持原有運動狀態（靜止或等速度直線運動）的性質，這正是牛頓第一運動定律的表現。主要干擾想法是「乘客受到向後的力」，但實際上並沒有任何力向後推乘客，向後傾是乘客「沒跟上」車子造成的相對運動，不是被推動，所以不能解釋成受力。' },
        { diff: 'pro', q: '冬天時，用手摸金屬欄杆會覺得比摸木頭扶手更冰冷，是因為金屬欄杆本身的溫度比木頭扶手低。', options: ['是', '非'], answer: [1], explain: '錯誤（非）。金屬欄杆和木頭扶手放在同一個空間裡，它們的溫度其實一樣，都等於室溫。感覺金屬更冷，是因為金屬的導熱能力比木頭好，能很快把手上的熱量傳走，皮膚溫度下降得快，才覺得冰冷。主要干擾項「金屬溫度比較低」是把「導熱快」誤當成「溫度低」；如果先量兩者的溫度，會發現完全相同。' },
    ],
    'social|4|multiple': [
        { diff: 'basic', q: '下列哪些是社區中大家可以共同使用的公共設施？', options: ['社區圖書館', '公園', '私人收費游泳池', '學校操場'], answer: [0, 1, 3], explain: '社區圖書館、公園、學校操場都是開放給大家共同使用的公共設施，通常由政府或學校提供與維護。私人收費游泳池須付費且屬私人經營，不是人人可自由使用的公共設施，是主要干擾項。' },
        { diff: 'basic', q: '下列哪些是臺灣原住民族的文化特色？', options: ['傳統祭典', '國慶日放煙火', '族群語言', '傳統服飾與工藝'], answer: [0, 2, 3], explain: '各部原住民族都有自己的傳統祭典、族群語言，以及代代相傳的服飾與工藝，這些都是珍貴的族群文化。國慶日放煙火是全國性的節慶活動，並非某一族群特有的傳統文化，為主要干擾項。' },
        { diff: 'basic', q: '到商店買東西時，下列哪些做法是正確的？', options: ['不看標示就直接買', '檢查商品的有效期限', '比較不同商品的價錢', '索取統一發票'], answer: [1, 2, 3], explain: '買東西前應先檢查有效期限、比較價錢，買完也要索取統一發票，才能保障自己的消費權益。完全不看標示就直接購買，可能買到過期或不適合的商品，是錯誤的做法，為主要干擾項。' },
        { diff: 'pro', q: '和家人到山區或海邊遊玩時，下列哪些做法可以保障自己的安全？', options: ['出發前先了解天氣狀況', '不擅自脫隊或前往危險區域', '看到警告標誌仍然下水游泳', '穿著適合的鞋子與衣物'], answer: [0, 1, 3], explain: '先了解天氣、不脫隊、不亂闖危險區、穿合適的鞋衣，都是事先設想可能危險並加以預防的安全做法。看到警告標誌仍下水，等於明知有危險還去做，無法保障安全，是主要干擾項。' },
        { diff: 'pro', q: '想要認識自己居住的家鄉，下列哪些做法有幫助？', options: ['查閱地圖與地方相關資料', '訪問社區裡的長輩', '實際走訪當地的特色景點', '只待在家裡不出門'], answer: [0, 1, 2], explain: '查資料、訪問長輩、實地走訪，能從不同來源蒐集家鄉的地理與人文資訊，是認識家鄉的具體方法。只待在家裡不出門就無法實際接觸與觀察家鄉，得不到新資訊，是主要干擾項。' },
    ],
    'social|4|single': [
        { diff: 'basic', q: '臺灣地區最高的山是哪一座？', options: ['雪山', '阿里山', '玉山', '合歡山'], answer: [2], explain: '正確答案是玉山。玉山海拔約三千九百五十二公尺，是臺灣第一高峰，也是臺灣重要的自然地標。主要干擾項「雪山」是臺灣第二高峰（約三千八百八十六公尺），高度略低於玉山，因此容易混淆；「阿里山」是知名山區與地名，並非最高峰；「合歡山」海拔約三千四百多公尺，也不是最高的一座。' },
        { diff: 'basic', q: '中秋節時，下列哪一項是臺灣常見的過節活動？', options: ['賞月、吃月餅', '划龍舟、吃粽子', '吃湯圓、猜燈謎', '貼春聯、拿紅包'], answer: [0], explain: '正確答案是賞月、吃月餅（有些家庭也會吃柚子、烤肉），這是中秋節最具代表性的習俗。主要干擾項「划龍舟、吃粽子」其實是端午節的活動；「吃湯圓、猜燈謎」屬於冬至與元宵節；「貼春聯、拿紅包」則是春節的習俗，三者都不是中秋節的活動。' },
        { diff: 'pro', q: '山坡地如果被過度開發、濫墾濫伐，遇到豪雨時最可能發生什麼結果？', options: ['山坡土石鬆動，容易發生土石流', '當地的地震次數會明顯增加', '海水倒灌淹沒平地', '天氣會變得乾燥、很少下雨'], answer: [0], explain: '正確答案是山坡土石鬆動、容易發生土石流。因為山坡地少了草木植被的保護，雨水直接沖刷泥土，土石便容易被帶往山下。主要干擾項「地震次數增加」是板塊運動造成的，與濫墾濫伐沒有直接因果關係；海水倒灌與地層下陷或颱風暴潮有關；乾燥少雨則和山坡地開發無關，所以三者都不是濫墾後的直接結果。' },
    ],
    'social|4|tf': [
        { diff: 'basic', q: '地圖上通常以「上北、下南、左西、右東」來標示方向。', options: ['是', '非'], answer: [0], explain: '正確。這是判讀地圖最基本的方位約定：圖的上方代表北方、下方代表南方、左方代表西方、右方代表東方，先記住這個規則才能說出圖上兩地之間的相對位置。選「非」的人常把方位和圖例、比例尺混為一談，以為方位要看圖上的圖例或比例尺才能決定；其實圖例是解釋符號、比例尺是換算實際距離，和固定不變的方位標示是不同的地圖要素。' },
        { diff: 'pro', q: '政府設立的公共圖書館、公園等公共設施，只提供給繳稅較多的人使用。', options: ['是', '非'], answer: [1], explain: '錯誤。公共設施是政府運用稅收等公共資源設置、供全體民眾共同使用的，使用機會不因個人繳稅多寡而不同；納稅是國民的義務，並不是換取公共服務的門票，所以「繳稅多才能用得多」的說法不成立。選「是」的人常把「有納稅」和「有資格使用公共設施」直接畫上等號，忽略了公共設施的共享性質；事實上即使尚未就業、沒有繳稅的兒童，一樣可以免費使用公共圖書館和公園。' },
    ],
    'social|6|multiple': [
        { diff: 'basic', q: '下列哪些是臺灣原住民族傳統的祭典？（可多選）', options: ['阿美族的豐年祭', '布農族的射耳祭', '賽夏族的矮靈祭', '西洋的萬聖節'], answer: [0, 1, 2], explain: '豐年祭（阿美族）、射耳祭（布農族）、矮靈祭（賽夏族）都是臺灣原住民族流傳已久的傳統祭典，與各族群的農獵生活及信仰有關。干擾項「西洋的萬聖節」是歐美宗教文化傳來的節日，並非臺灣原住民族的傳統祭典，因此不選。' },
        { diff: 'basic', q: '臺灣的氣候有什麼特徵？（可多選）', options: ['夏天高溫多雨', '冬天常有東北季風', '大致以北回歸線為界，分為熱帶與副熱帶氣候', '全年都是乾燥的沙漠氣候'], answer: [0, 1, 2], explain: '臺灣夏季高溫多雨、冬季受東北季風影響，且北回歸線穿過嘉義與花蓮，以北為副熱帶、以南為熱帶氣候，故前三項正確。干擾項「全年都是乾燥的沙漠氣候」明顯錯誤，臺灣四面環海、雨量豐沛，不是沙漠氣候。' },
        { diff: 'basic', q: '下列哪些是國民應盡的義務？（可多選）', options: ['納稅', '接受國民教育', '遵守法律', '依自己喜好任意決定要不要上學'], answer: [0, 1, 2], explain: '納稅、接受國民教育、遵守法律都是《憲法》與法律明定的國民義務，故前三項正確。干擾項「依自己喜好任意決定要不要上學」與義務教育「國民有受教育的權利與義務」的精神相反，屬於可以自由選擇的觀念，不是應盡的義務。' },
        { diff: 'pro', q: '臺灣的中央山脈大致呈南北走向、並偏在島的東側，這樣的特徵會造成什麼結果？（可多選）', options: ['河川大多短而急促，向西或向東流入海', '必須修建許多橋梁與隧道，南北向交通才方便', '西半部平原較廣，人口與都市多集中在此', '全島各地降雨量完全一樣，沒有東西部差異'], answer: [0, 1, 2], explain: '中央山脈南北縱貫且偏東，使河川短急、東西向入海；南北往來需跨越眾多河川與山嶺，故橋梁隧道多；山脈以西有較廣的平原，人口與都市因而集中西部。干擾項「全島降雨量完全一樣」錯誤，山脈會阻擋水氣，使西部與東部的降雨有明顯差異。' },
        { diff: 'pro', q: '關於十七世紀外來政權在臺灣的經營，下列哪些敘述正確？（可多選）', options: ['荷蘭人曾占領並統治臺灣南部', '西班牙人曾占領並統治臺灣北部', '兩者都曾在臺灣從事商業貿易', '兩者都是二十世紀才來到臺灣'], answer: [0, 1, 2], explain: '十七世紀時荷蘭人統治臺灣南部、西班牙人統治北部，並都以貿易為主要目的，故前三項正確。干擾項「兩者都是二十世紀才來到臺灣」錯在時間：荷蘭與西班牙都是在十七世紀（約1624至1662年間）來臺，二十世紀的統治者是日本（1895至1945年）。' },
        { diff: 'pro', q: '小明和鄰居因為圍牆的位置發生糾紛，決定先到鄉鎮市區公所的調解委員會聲請調解。如果調解成立，會產生什麼結果？（可多選）', options: ['雙方互相讓步，達成協議', '紛爭在進入法院訴訟前就獲得解決', '成立並經法院核定後，具有與法院判決相同的效力', '調解成立後，小明就必須放棄自己所有的財產'], answer: [0, 1, 2], explain: '調解是由公正第三人協助雙方互相讓步、達成協議，屬於訴訟外的紛爭解決方式，可不經漫長訴訟；調解成立並送法院核定後，效力與確定判決相同，故前三項正確。干擾項「必須放棄自己所有的財產」是過度誇大的說法，調解內容由雙方合理協商決定，並非無條件放棄全部財產。' },
    ],
    'social|6|single': [
        { diff: 'basic', q: '關於臺灣本島的地形，下列哪一項敘述正確？', options: ['平原多、山地少，地勢西高東低', '全島地勢平坦，幾乎沒有山脈', '山地多、平原少，地勢東高西低', '西部為高山，東部為平原'], answer: [2], explain: '臺灣本島山地面積約占三分之二，平原較少；中央山脈偏東，山脈以西地勢逐漸降低形成平原，所以是「東高西低」。主要干擾項「西高東低」把高低方向說反了，是常見的錯誤；另兩項則與臺灣多山、有中央山脈的事實不符。' },
        { diff: 'basic', q: '早期漢人移民大多從哪個方向渡海來臺開墾？', options: ['歐洲大陸', '中國東南沿海（如福建、廣東）', '非洲南部', '北美洲'], answer: [1], explain: '明鄭與清領時期，來自福建、廣東的漢人渡過臺灣海峽來臺開墾，是早期漢人移民的主要來源。主要干擾項「歐洲大陸」雖曾在荷蘭、西班牙時期有歐洲人來臺，但那些人並非漢人移民，方向也與題意不符。' },
        { diff: 'pro', q: '臺灣西南部沿海地區若長期超抽地下水來養殖魚塭，最可能造成下列哪一種後果？', options: ['地層抬升，山脈跟著長高', '海水自動變成淡水', '地層下陷，低窪地區容易淹水', '當地氣溫明顯下降'], answer: [2], explain: '地下水被大量抽走後，地層失去水的支撐而壓密下陷，低窪地區排水不良、遇雨容易淹水，這是臺灣沿海常見的環境問題。主要干擾項「地層抬升」把結果說成相反方向，是刻意設計的干擾；另外兩項與抽取地下水的後果無關。' },
        { diff: 'pro', q: '民主國家的憲法為什麼要保障人民的「言論自由」？', options: ['因為政府不想管理人民的行為', '讓人們能自由表達意見、監督政府、交流想法', '讓人們可以任意誹謗他人而不必負責', '表示言論自由完全不需要任何限制'], answer: [1], explain: '言論自由是人民的基本權利，能讓大家表達意見、討論公共事務並監督政府，是民主社會的重要基礎。主要干擾項把自由誤解成「可以任意誹謗他人而不必負責」；其實言論自由仍受法律規範，散布謠言或侵害他人名譽仍須負法律責任，並非毫無限制。' },
    ],
    'social|6|tf': [
        { diff: 'basic', q: '濁水溪是臺灣最長的河川。', options: ['是', '非'], answer: [0], explain: '正確。濁水溪發源於中央山脈，全長約一百八十六公里，是臺灣最長的河川。選「非」的人常把「流域面積最大」的高屏溪誤認成最長；高屏溪是臺灣流域面積最大的河川，但長度略短於濁水溪，兩者不能混為一談。' },
        { diff: 'pro', q: '十七世紀時，荷蘭人曾經統治臺灣南部，後來被鄭成功率領軍隊驅逐，之後清朝才將臺灣納入版圖。', options: ['是', '非'], answer: [0], explain: '正確。荷蘭人於一六二四年占領臺灣南部，一六六二年被鄭成功驅逐；鄭氏王朝統治二十多年後，清朝才在一六八三年將臺灣納入版圖，三個事件的先後順序正確。選「非」的人通常有兩種誤解：一是以為鄭成功驅逐荷蘭人之後清朝就立刻接管（中間還隔了鄭氏王朝），二是以為荷蘭人統治全臺（實際上只統治南部，北部另有西班牙人據點）。' },
    ],
    'social|8|multiple': [
        { diff: 'basic', q: '下列哪些是臺灣原住民族文化的特色？(可多選)', options: ['各族擁有自己的語言', '各族保有各自的傳統祭典', '早期多以狩獵、漁撈或農耕維生', '各族的語言與祭典完全一致'], answer: [0, 1, 2], explain: '臺灣原住民族各族群都有獨特的語言、祭典與傳統生計方式（狩獵、漁撈、農耕等），這是「族群多元」最基本的辨認。第 4 項說「各族語言與祭典完全一致」正好相反：正因各族語言、祭典互不相同，才構成臺灣原住民族的文化多樣性，是主要干擾項。' },
        { diff: 'basic', q: '下列哪些屬於人民享有的「權利」，而不是應盡的「義務」？(可多選)', options: ['言論自由', '遷徙自由', '依法納稅', '選舉權'], answer: [0, 1, 3], explain: '言論自由、遷徙自由與選舉權都是憲法賦予人民可以主張的權利。第 3 項「依法納稅」是人民對國家應盡的義務，不是權利，只是它常與權利一同出現在公民課本中，容易被誤選，是主要干擾項。' },
        { diff: 'pro', q: '中國的黃河流經黃土高原，下游河床淤積、容易氾濫成災，主要與下列哪些因素有關？(可多選)', options: ['黃土高原的土質疏鬆，容易被河水沖刷', '河水中含沙量大，泥沙在下游沉積抬高河床', '降水集中在夏季，水量變化大', '黃河河道終年結冰，水流完全停止'], answer: [0, 1, 2], explain: '黃河的問題是一連串因果：黃土高原土質疏鬆（因）→ 河水挾帶大量泥沙（果，也是下一段的原因）→ 泥沙在下游沉積、河床抬高形成「地上河」，加上夏季降水集中使水量暴增，因而容易氾濫。第 4 項錯在黃河並非終年結冰、水流全停（只有部分河段冬季結冰，並曾造成凌汛），與氾濫的主因無關，是主要干擾項。' },
        { diff: 'pro', q: '民主國家的政府權力分為行政、立法、司法三部分，下列哪些屬於行政部門的職權？(可多選)', options: ['執行法令與推動政策', '編列並執行政府預算', '審查法案並進行表決', '審理訴訟並作出判決'], answer: [0, 1], explain: '行政部門負責「執行」：落實法律與政策，並編列、執行預算。第 3 項「審查法案並表決」屬於立法部門（在臺灣是立法院）的職權；第 4 項「審理訴訟並作出判決」屬於司法部門（法院）的職權，兩者都是把「執行」誤當成行政，是主要干擾項。' },
        { diff: 'pro', q: '在民主社會中，法律對人民與政府具有下列哪些功能？(可多選)', options: ['保障人民的基本權利', '維持社會秩序', '避免政府權力被濫用', '讓執政者可以任意處罰人民'], answer: [0, 1, 2], explain: '法律的兩大作用是保護人民權利、維持社會秩序，同時透過明確規範來「節制」政府權力，避免統治者濫權。第 4 項說法律是讓執政者「任意處罰」人民的工具，正好與法治精神相反——依法行政的重點正是限制政府不能任意妄為，是主要干擾項。' },
        { diff: 'challenge', q: '考古學家在臺灣某遺址發現大量貝殼、石器、陶片，以及碳化的稻米與小米種子。根據這些發現，下列哪些推論最合理？(可多選)', options: ['當地居民已會製作並使用石器與陶器', '當地居民可能已種植稻米、小米等作物', '採集貝類是當地居民取得食物的方式之一', '當地居民已使用行動電話與外界聯絡'], answer: [0, 1, 2], explain: '這題要把「出土物」和「生活推論」對應起來：出現石器、陶片可推知已有製作與使用石、陶器的技術；出現碳化稻米與小米種子，可合理推論已有農業耕種；大量貝殼則指向採集貝類為食物來源之一。推論須以出土證據為限；第 4 項「行動電話」是現代科技產物，不可能出現在史前遺址，且無任何證據支持，是主要干擾項。' },
    ],
    'social|8|single': [
        { diff: 'basic', q: '臺灣目前有六個直轄市，下列哪一個是直轄市？', options: ['臺中市', '新竹市', '嘉義市', '苗栗市'], answer: [0], explain: '臺中市在 2010 年與臺中縣合併升格為直轄市，是臺灣六個直轄市（臺北、新北、桃園、臺中、臺南、高雄）之一。新竹市、嘉義市為省轄市，苗栗市為縣轄市，三者都不是直轄市，是刻意安排的地名干擾項。' },
        { diff: 'basic', q: '臺灣最長的河川是哪一條？', options: ['濁水溪', '高屏溪', '淡水河', '曾文溪'], answer: [0], explain: '濁水溪全長約 186 公里，是臺灣最長的河川，主流發源於中央山脈。高屏溪雖然流域面積最大，但長度略短，是常見的混淆選項；淡水河與曾文溪長度都更短。' },
        { diff: 'pro', q: '小華看到有人違規停車擋住消防通道，下列哪一種做法最符合民主法治的精神？', options: ['記下車號並向警方或相關單位檢舉通報', '直接破壞車輛以示警告', '把對方的照片與個人資料公布在網路上', '覺得不關自己的事，完全不處理'], answer: [0], explain: '民主法治社會中，遇到違法情形應透過合法管道（如向警方或主管機關檢舉）處理，由公權力依法認定與處置，這才是正當的公民參與。直接破壞車輛會構成毀損罪，公布他人照片與個資可能觸犯個人資料保護法或妨害名譽，兩者都是以違法手段對抗違法；完全不處理則放棄了維護公共安全的責任。' },
        { diff: 'pro', q: '阿明把存款存入銀行，一年後領到利息。這筆利息在他的所得來源分類上屬於下列哪一種？', options: ['薪資（勞動）所得', '資本（財產）所得', '政府移轉所得', '機會成本'], answer: [1], explain: '把資金（資本）存入銀行所賺取的利息，是運用資本財貨獲得的報酬，屬於資本（財產）所得。薪資所得是付出勞力工作換得的報酬，此處阿明並未提供勞務，故不是薪資所得；政府移轉所得指政府發放的補助或津貼；機會成本則是做選擇時所放棄的最佳替代方案，並非一種所得。' },
        { diff: 'pro', q: '我國憲法保障人民的基本權利，其中「人民有受國民教育的權利與義務」屬於下列哪一種權利？', options: ['平等權', '自由權', '受益權', '參政權'], answer: [2], explain: '國中公民將憲法基本權利分為平等權、自由權、受益權、參政權四類。受國民教育的權利是請求國家提供教育資源、使人民從中受益，屬於受益權。平等權強調身分地位的不差別待遇，自由權保障言論、遷徙等不受干預的自由，參政權則是選舉、罷免、創制、複決等參與政治的權利，三者皆非教育權的性質。' },
        { diff: 'challenge', q: '臺灣東部的河川和西部河川相比，普遍具有「短、急、落差大」的特性，下列哪一項是造成這種差異最主要的原因？', options: ['東部山脈緊臨海岸，河川從高山直落入海，坡陡而流短', '東部的年雨量遠少於西部，河川水量不足', '東部平原面積廣大，河川被大量分流', '東部地勢平坦，河川流速因而較緩慢'], answer: [0], explain: '東部海岸山脈與中央山脈緊臨海岸，分水嶺到出海口的水平距離短，河川自高山急速下降入海，因此形成短促、坡陡、流急、落差大的特性；西部有較寬廣的沖積平原，河川流程較長、坡度較緩。東部其實因颱風與地形抬升，年雨量常高於西部，故「雨量少」的說法錯誤；東部平原狹小、地勢陡峻，所以「平原廣大」「地勢平坦」也與事實相反。' },
    ],
    'social|8|tf': [
        { diff: 'pro', q: '機會成本是指在做選擇時，所放棄的其他選項中，價值最高的那一個。', options: ['是', '非'], answer: [0], explain: '正確。機會成本是「為了選擇某一方案，而放棄的替代方案中價值最高的那一個」，強調的是被放棄選項裡代價最大者。主要干擾在於容易誤把機會成本想成「所有放棄選項的價值加總」，或誤以為機會成本只等於實際付出的金錢（會計成本）；實際上即使沒有花到錢，只要放棄了更有價值的選項，就構成了機會成本。機會成本的判斷需要比較各替代方案，屬於兩步推理，不是查定義即可。' },
        { diff: 'pro', q: '臺灣的河川坡陡流急，雨水很快就流入海洋，因此臺灣地區不會出現缺水的問題。', options: ['是', '非'], answer: [1], explain: '錯誤。臺灣雖然年雨量豐沛，但河川短促、坡陡流急，雨水快速流入海洋而難以蓄存，加上降雨在季節上分布不均（集中在梅雨與颱風季），因此部分地區在枯水期仍常缺水，需要靠水庫調節與節約用水。主要干擾項的錯誤在於把「雨量多」直接等同於「不缺水」，忽略了坡陡流急以致留不住水、以及季節分布不均這兩個關鍵因素。' },
    ],
};

// ---------------------------------------------------------------- CHINESE
// Hand-authored sets per band. `zyMap` gives per-character zhuyin for grades 2-3.
// 學習階段分帶（中年級/高年級/國中），四個語文/社會/自然科共用同一份分帶定義，
// 由 buildChinese 填入內容後，其他科在各自的 build* 裡讀取。
let advBands = null;

function buildChinese() {

    // tiers: targetGrade 2..10
    for (let g = 2; g <= 10; g++) {
        // Items at target grade 2-3 are served to 國小一、二年級, so they need 注音.
        const low = g <= 3; // target grade 2-3 => 國小一、二年級 => needs 注音
        const tf = [
            { diff: 'basic', q: '「太陽像一個大火球」這句話使用了譬喻修辭。', options: ['是', '非'], answer: [0], explain: '「像」是喻詞，把太陽比喻成火球，屬於譬喻修辭。' },
            { diff: 'basic', q: '「一心一意」的意思是指做事非常專心。', options: ['是', '非'], answer: [0], explain: '「一心一意」形容心思專一、非常專注。' },
            { diff: 'basic', q: '「他跑得很快」中的「很快」是在補充說明「跑」的狀態。', options: ['是', '非'], answer: [0], explain: '「很快」是補語，補充說明動詞「跑」的程度。' },
            { diff: 'basic', q: '「媽媽買了蘋果。」這句話的主語是「蘋果」。', options: ['是', '非'], answer: [1], explain: '主語是「媽媽」，「蘋果」是賓語。' },
            { diff: 'pro', q: '「春風又綠江南岸」中的「綠」字當動詞使用。', options: ['是', '非'], answer: [0], explain: '「綠」在此由形容詞轉作動詞，意思是「使……變綠」，屬轉品修辭。' },
            { diff: 'pro', q: '「千鈞一髮」用來形容非常危險、情勢緊急。', options: ['是', '非'], answer: [0], explain: '「千鈞一髮」比喻情勢萬分危急。' },
            { diff: 'pro', q: '「他的脾氣像火山一樣」只是單純的敘述，沒有使用修辭。', options: ['是', '非'], answer: [1], explain: '此句使用譬喻修辭，將脾氣比擬為火山。' },
            { diff: 'challenge', q: '「明月松間照，清泉石上流」兩句都使用了倒裝的語序。', options: ['是', '非'], answer: [0], explain: '原意為「明月照松間，清泉流石上」，句中將「松間」「石上」提前，屬倒裝。' }
        ];
        const single = [
            { diff: 'basic', q: '下列哪一個詞語是「名詞」？', options: ['學校', '跑步', '美麗', '非常'], answer: [0], explain: '「學校」是名詞；「跑步」是動詞，「美麗」是形容詞，「非常」是副詞。' },
            { diff: 'basic', q: '「小鳥在樹上唱歌」這句話中，「在樹上」表示什麼？', options: ['地點', '時間', '原因', '數量'], answer: [0], explain: '「在樹上」說明動作發生的地點。' },
            { diff: 'basic', q: '下列哪一個字讀音和其他三個不同？', options: ['早', '草', '操', '吵'], answer: [0], explain: '「早」聲母為 ㄗ，其餘三者聲母為 ㄘ／ㄘ／ㄔ，其中「早」讀音明顯不同。' },
            { diff: 'pro', q: '「他的笑聲像銀鈴般清脆」使用了哪一種修辭？', options: ['譬喻', '擬人', '排比', '設問'], answer: [0], explain: '以「像」將笑聲比喻為銀鈴，屬譬喻修辭。' },
            { diff: 'pro', q: '下列哪一個成語帶有「褒義」（讚美、肯定）？', options: ['高瞻遠矚', '處心積慮', '巧言令色', '狼狽為奸'], answer: [0], explain: '「高瞻遠矚」形容眼光遠大，為褒義；其餘三者為貶義。' },
            { diff: 'pro', q: '「風在樹梢低聲吟唱」使用了哪一種修辭？', options: ['擬人', '譬喻', '誇飾', '對偶'], answer: [0], explain: '將「風」賦予「低聲吟唱」的人類行為，屬擬人修辭。' },
            { diff: 'challenge', q: '「不恥下問」的「恥」字在句中的意思是什麼？', options: ['以……為恥', '羞恥的事', '侮辱別人', '感到慚愧'], answer: [0], explain: '「不恥下問」指不以向地位比自己低的人請教為恥，「恥」是意動用法。' },
            { diff: 'challenge', q: '下列文句何者沒有語病？', options: ['他不但功課好，而且品行端正', '他不但功課好，而且品行很端正的人', '他不但功課好，並且是品行端正', '他不但功課好，品行端正而且'], answer: [0], explain: '「不但……而且……」須接兩個結構對稱的敘述，只有第一項語意完整通順。' }
        ];
        const multiple = [
            { diff: 'basic', q: '下列哪些詞語是「形容詞」？（可多選）', options: ['漂亮', '聰明', '跑', '書本'], answer: [0, 1], explain: '「漂亮」「聰明」是形容詞；「跑」是動詞，「書本」是名詞。' },
            { diff: 'basic', q: '下列哪些句子用了「問句」的語氣？（可多選）', options: ['你今天開心嗎？', '這是什麼東西？', '我好開心。', '請坐。'], answer: [0, 1], explain: '前兩句為疑問句；後兩句為直述句與祈使句。' },
            { diff: 'pro', q: '下列哪些成語的意思與「專心致志」相近？（可多選）', options: ['聚精會神', '全神貫注', '心不在焉', '一心一意'], answer: [0, 1, 3], explain: '「聚精會神」「全神貫注」「一心一意」都表示專注；「心不在焉」意思相反。' },
            { diff: 'pro', q: '下列哪些選項屬於「譬喻」修辭？（可多選）', options: ['太陽像一顆大火球', '妹妹的臉紅得像蘋果', '風輕輕地吹過', '時間就是金錢'], answer: [0, 1, 3], explain: '前三項中第 3 項只是敘述；「時間就是金錢」為隱喻，也算譬喻。' },
            { diff: 'pro', q: '關於記敘文的要素，下列哪些正確？（可多選）', options: ['人物', '時間', '地點', '押韻'], answer: [0, 1, 2], explain: '記敘文要素包含人物、時間、地點、事件；押韻不是必要要素。' },
            { diff: 'challenge', q: '下列哪些詞語為「貶義詞」？（可多選）', options: ['處心積慮', '巧言令色', '鞠躬盡瘁', '見風轉舵'], answer: [0, 1, 3], explain: '「處心積慮」「巧言令色」「見風轉舵」為貶義；「鞠躬盡瘁」是褒義。' },
            { diff: 'challenge', q: '下列哪些是「轉品」（詞性轉換）的用法？（可多選）', options: ['春風又「綠」江南岸', '「白」了少年頭', '他「跑」得很快', '「春」風拂面'], answer: [0, 1], explain: '「綠」「白」皆由形容詞轉作動詞，屬轉品；其餘為一般用法。' },
            { diff: 'challenge', q: '下列哪些文句使用「對偶」修辭？（可多選）', options: ['兩個黃鸝鳴翠柳，一行白鷺上青天', '明月松間照，清泉石上流', '他很高，也很瘦', '花開花落'], answer: [0, 1], explain: '前兩項字數、結構對稱，屬對偶；後兩項不符合對偶條件。' }
        ];

        const tfExtra = [
            { diff: 'basic', q: '「他昨天去圖書館看書。」這句話是在敘述已經發生的事。', options: ['是', '非'], answer: [0], explain: '「昨天」表示過去時間，句子敘述已完成的事。' },
            { diff: 'basic', q: '「請你把門關上。」是祈使句。', options: ['是', '非'], answer: [0], explain: '「請……」表示請求或命令，屬祈使句。' },
            { diff: 'pro', q: '「這朵花真美啊！」句末的「啊」是嘆詞。', options: ['是', '非'], answer: [0], explain: '「啊」在此表達讚嘆語氣，是嘆詞。' },
            { diff: 'challenge', q: '「十年樹木，百年樹人」中的「樹」都當動詞用。', options: ['是', '非'], answer: [0], explain: '「樹木」「樹人」的「樹」都是動詞，意為種植、培育。' }
        ];
        const singleExtra = [
            { diff: 'basic', q: '「太陽公公露出了笑臉」使用了哪一種修辭？', options: ['擬人', '譬喻', '誇飾', '設問'], answer: [0], explain: '將太陽擬人化為會「露出笑臉」的人，屬擬人修辭。' },
            { diff: 'basic', q: '下列哪一個詞語是「動詞」？', options: ['奔跑', '紅色', '桌子', '快樂'], answer: [0], explain: '「奔跑」是動詞；「紅色」「快樂」是形容詞，「桌子」是名詞。' },
            { diff: 'pro', q: '「一鳴驚人」的意思是什麼？', options: ['平時默默無聞，一旦表現便使人驚異', '一次就成功', '鳥叫聲很大', '喜歡熱鬧'], answer: [0], explain: '「一鳴驚人」比喻平時沒沒無聞，一下子做出驚人的成績。' },
            { diff: 'challenge', q: '「他的脾氣很____，常常為小事發火。」空格應填入？', options: ['暴躁', '暴躁地', '暴燥', '爆躁'], answer: [0], explain: '形容脾氣應使用形容詞「暴躁」，其餘為錯別字。' }
        ];
        const multipleExtra = [
            { diff: 'basic', q: '下列哪些是「標點符號」？(可多選)', options: ['逗號', '句號', '問號', '書名'], answer: [0, 1, 2], explain: '逗號、句號、問號是標點符號；書名是名詞。' },
            { diff: 'pro', q: '下列哪些句子使用了「設問」修辭？(可多選)', options: ['什麼是幸福？幸福就是知足。', '難道我們不該努力嗎？', '今天天氣很好。', '你快樂嗎？', ], answer: [0, 1], explain: '設問是作者自問自答或提出問題引起注意，前兩項符合。' },
            { diff: 'challenge', q: '下列哪些屬於「摹寫」修辭？(可多選)', options: ['視覺摹寫', '聽覺摹寫', '嗅覺摹寫', '誇張摹寫'], answer: [0, 1, 2], explain: '摹寫分為視覺、聽覺、嗅覺、味覺、觸覺，「誇張摹寫」不是分類。' },
            // 下面兩題是為了讓「basic 多選」有足夠的相異內容：expandVariants 會
            // 循環填充，但循環出來的是同一題文字，同卷去重會把它丟掉，卷子就少一題。
            { diff: 'basic', q: '下列哪些詞語可以用來形容「聲音」？(可多選)', options: ['宏亮', '沙啞', '方正', '清脆'], answer: [0, 1, 3], explain: '「宏亮」「沙啞」「清脆」都能形容聲音；「方正」形容形狀。' },
            { diff: 'basic', q: '下列哪些詞語是「量詞」？(可多選)', options: ['一「朵」花', '一「匹」馬', '一「張」紙', '一「美麗」花'], answer: [0, 1, 2], explain: '「朵」「匹」「張」都是量詞；「美麗」是形容詞，不是量詞。' }
        ];
        const tfAll = expandVariants(tf, 12, tfExtra);
        const singleAll = expandVariants(single, 12, singleExtra);
        const multipleAll = expandVariants(multiple, 12, multipleExtra);

        const tagZy = (arr) => arr.map(it => ({
            id: nid('chinese', g, 'x'),
            zhuyin: low ? zhuyinOf(it.q) : null,
            ...it
        }));
        tagZy(tfAll).forEach(it => push('chinese', g, 'tf', { ...it, id: nid('chinese', g, 'tf'), scope: 2 }));
        tagZy(singleAll).forEach(it => push('chinese', g, 'single', { ...it, id: nid('chinese', g, 'single'), scope: 2 }));
        tagZy(multipleAll).forEach(it => push('chinese', g, 'multiple', { ...it, id: nid('chinese', g, 'multiple'), scope: 2 }));
    }

    // ---- 進階語文（S2 / S3 / S4）----------------------------------------------
    // 原本每個年級桶都推同一份陣列，小一到國三考的是完全一樣的題目（實測
    // 跨年級題面重疊 100%）。下面的 band 只在「該學習階段」的桶裡出現，
    // scope=最早可出現的目標年級（沿用數學科同一套欄位語意）。
    advBands = [
        {
            scope: 4, from: 4, to: 5, title: '中年級',
            sci: {
                tf: [
                    { diff: 'basic', q: '磁鐵的兩極會互相吸引。', options: ['是', '非'], answer: [1], explain: '同名極相斥、異名極相吸，兩極未必互相吸引。' },
                    { diff: 'basic', q: '水結成冰時體積會變大。', options: ['是', '非'], answer: [0], explain: '水結冰時體積膨脹，所以冰會浮在水面上。' },
                    { diff: 'basic', q: '植物行光合作用需要陽光。', options: ['是', '非'], answer: [0], explain: '光合作用需要光、水與二氧化碳。' },
                    { diff: 'pro', q: '所有會飛的動物都是鳥類。', options: ['是', '非'], answer: [1], explain: '蝙蝠會飛但屬於哺乳類，不是鳥類。' },
                    { diff: 'pro', q: '聲音可以在真空中傳播。', options: ['是', '非'], answer: [1], explain: '聲音需要介質，真空中無法傳播。' },
                    { diff: 'challenge', q: '食鹽溶於水後，水溶液的重量等於鹽加水原來的總重。', options: ['是', '非'], answer: [0], explain: '溶解是物理變化，質量守恆。' }
                ],
                single: [
                    { diff: 'basic', q: '下列哪一種動物是卵生？', options: ['雞', '狗', '牛', '貓'], answer: [0], explain: '雞生蛋孵出小雞，是卵生動物。' },
                    { diff: 'basic', q: '下列哪一種是天氣現象？', options: ['下雨', '地震', '火山爆發', '潮汐'], answer: [0], explain: '下雨屬於天氣現象，其餘是地質或天文現象。' },
                    { diff: 'pro', q: '腳踏車煞車時，是運用什麼力讓車停下來？', options: ['摩擦力', '磁力', '彈力', '重力'], answer: [0], explain: '煞車皮與輪圈摩擦產生摩擦力，使車減速。' },
                    { diff: 'pro', q: '下列哪一種能源屬於再生能源？', options: ['太陽能', '煤', '石油', '天然氣'], answer: [0], explain: '太陽能可持續補充，屬再生能源。' },
                    { diff: 'challenge', q: '把鐵釘放入硫酸銅溶液，鐵釘表面會附著什麼顏色的物質？', options: ['紅褐色', '銀白色', '黑色', '黃色'], answer: [0], explain: '鐵置換出銅，附著紅褐色的銅。' },
                    { diff: 'challenge', q: '下列哪一項可以減緩山坡地的土壤流失？', options: ['種植草木', '把樹砍光', '鋪滿水泥', '挖深溝'], answer: [0], explain: '植物根系能抓住土壤，減少沖刷。' }
                ],
                multiple: [
                    { diff: 'basic', q: '下列哪些屬於生物？(可多選)', options: ['榕樹', '蝴蝶', '石頭', '蚯蚓'], answer: [0, 1, 3], explain: '石頭沒有生命現象，不是生物。' },
                    { diff: 'basic', q: '下列哪些是可回收的資源？(可多選)', options: ['寶特瓶', '鐵罐', '紙箱', '用過的衛生紙'], answer: [0, 1, 2], explain: '用過的衛生紙因衛生與纖維問題不可回收。' },
                    { diff: 'pro', q: '下列哪些方法可以節約用水？(可多選)', options: ['淋浴取代泡澡', '隨手關緊水龍頭', '用洗米水澆花', '水龍頭一直開著刷牙'], answer: [0, 1, 2], explain: '前三項都能減少用水。' },
                    { diff: 'pro', q: '下列哪些屬於力的作用？(可多選)', options: ['推門', '拉橡皮筋', '踢球', '看電視'], answer: [0, 1, 2], explain: '前三者都施力於物體；看電視沒有施力。' },
                    { diff: 'challenge', q: '關於昆蟲，下列哪些敘述正確？(可多選)', options: ['身體分為頭、胸、腹三部分', '有六隻腳', '都有翅膀', '大多有觸角'], answer: [0, 1, 3], explain: '有些昆蟲（如螞蟻的部分階級）沒有翅膀。' },
                    { diff: 'challenge', q: '下列哪些是可觀察到的天氣要素？(可多選)', options: ['氣溫', '風向', '雲量', '地層年代'], answer: [0, 1, 2], explain: '地層年代不是天氣要素。' }
                ]
            },
            soc: {
                tf: [
                    { diff: 'basic', q: '台灣四周環海，西部海岸較多沙岸。', options: ['是', '非'], answer: [0], explain: '台灣西部多沙岸，東部多岩岸。' },
                    { diff: 'basic', q: '遵守交通號誌是每一位用路人的責任。', options: ['是', '非'], answer: [0], explain: '遵守號誌能保障自己與他人的安全。' },
                    { diff: 'basic', q: '台灣的行政區中，離島也屬於某個縣或市管轄。', options: ['是', '非'], answer: [0], explain: '例如澎湖縣、金門縣、連江縣都是離島行政區。' },
                    { diff: 'pro', q: '投票時可以代替別人投票。', options: ['是', '非'], answer: [1], explain: '投票須本人親自為之，不能代理。' },
                    { diff: 'pro', q: '古蹟一旦指定，就可以任意改建或拆除。', options: ['是', '非'], answer: [1], explain: '古蹟受文化資產法保護，不得任意改建或拆除。' },
                    { diff: 'challenge', q: '台灣的河川大多東西向流入海，因此南北向的交通常需跨越河川。', options: ['是', '非'], answer: [0], explain: '中央山脈偏東，河川多向西流，南北交通須跨橋。' }
                ],
                single: [
                    { diff: 'basic', q: '下列哪一項是地方自治的機關？', options: ['縣（市）政府', '便利商店', '銀行', '電視台'], answer: [0], explain: '縣（市）政府是地方行政機關。' },
                    { diff: 'basic', q: '台灣主要的稻米產區多位於何處？', options: ['平原', '高山', '沙漠', '冰原'], answer: [0], explain: '平原有水源與平坦地形，適合種稻。' },
                    { diff: 'pro', q: '下列哪一項是公民應盡的義務？', options: ['納稅', '看電影', '出國旅遊', '買東西'], answer: [0], explain: '納稅、服兵役、受國民教育是公民義務。' },
                    { diff: 'pro', q: '「社區營造」最主要的目的為何？', options: ['由居民共同改善生活環境', '增加房價', '蓋更多大樓', '吸引觀光客拍照'], answer: [0], explain: '社區營造強調居民參與、共同改善環境。' },
                    { diff: 'challenge', q: '下列哪一項最能減少垃圾量？', options: ['自備購物袋與容器', '多買包裝精美的商品', '把垃圾丟進河裡', '燃燒塑膠'], answer: [0], explain: '源頭減量最有效；任意棄置或燃燒會造成污染。' },
                    { diff: 'challenge', q: '台灣原住民族的文化資產中，「歲時祭儀」主要功能為何？', options: ['凝聚族群與傳承文化', '買賣商品', '選舉幹部', '徵收稅金'], answer: [0], explain: '祭儀兼具凝聚族群情感與文化傳承的功能。' }
                ],
                multiple: [
                    { diff: 'basic', q: '下列哪些是公共場所應遵守的規則？(可多選)', options: ['排隊', '輕聲交談', '隨地丟垃圾', '禮讓老弱'], answer: [0, 1, 3], explain: '隨地丟垃圾是違規行為。' },
                    { diff: 'basic', q: '下列哪些是台灣常見的自然災害？(可多選)', options: ['颱風', '地震', '土石流', '沙塵暴（終年不斷）'], answer: [0, 1, 2], explain: '台灣常見颱風、地震與豪雨引發的土石流。' },
                    { diff: 'pro', q: '下列哪些做法可以保護環境？(可多選)', options: ['垃圾分類', '節約能源', '隨意放生外來種', '搭乘大眾運輸'], answer: [0, 1, 3], explain: '隨意放生外來種會破壞生態。' },
                    { diff: 'pro', q: '下列哪些是民主社會中表達意見的方式？(可多選)', options: ['參加公聽會', '連署', '投書媒體', '破壞公物'], answer: [0, 1, 2], explain: '破壞公物是違法行為，不是正當表達方式。' },
                    { diff: 'challenge', q: '關於文化資產，下列哪些敘述正確？(可多選)', options: ['可分為有形與無形', '古蹟屬有形文化資產', '傳統技藝屬無形文化資產', '文化資產與生活無關'], answer: [0, 1, 2], explain: '文化資產與常民生活密切相關。' },
                    { diff: 'challenge', q: '下列哪些屬於地方政府的職權？(可多選)', options: ['興建學校', '維護道路', '制定全國法律', '辦理地方選舉'], answer: [0, 1, 3], explain: '制定全國法律是中央立法機關的職權。' }
                ]
            },
            eng: {
                tf: [
                    { diff: 'basic', q: '"I am a student" means the speaker is a student.', options: ['True', 'False'], answer: [0], explain: 'The sentence states that the speaker is a student.' },
                    { diff: 'basic', q: 'We use "an" before a word that starts with a consonant sound.', options: ['True', 'False'], answer: [1], explain: '"An" is used before a vowel SOUND, e.g. "an apple".' },
                    { diff: 'basic', q: '"They are playing" describes an action happening now.', options: ['True', 'False'], answer: [0], explain: 'The present continuous describes an action in progress.' },
                    { diff: 'pro', q: '"Yesterday I go to school" is a correct sentence.', options: ['True', 'False'], answer: [1], explain: 'With "yesterday" use the past tense: "I went".' },
                    { diff: 'pro', q: 'A countable noun can be used with a number, e.g. "three books".', options: ['True', 'False'], answer: [0], explain: 'Countable nouns have singular and plural forms.' },
                    { diff: 'challenge', q: '"If it rains tomorrow, I will stay home" is a correct first conditional.', options: ['True', 'False'], answer: [0], explain: 'First conditional: if + present simple, will + base verb.' }
                ],
                single: [
                    { diff: 'basic', q: 'Choose the correct word: "She ____ a doctor."', options: ['is', 'are', 'am', 'be'], answer: [0], explain: 'Third person singular takes "is".' },
                    { diff: 'basic', q: 'What is the past tense of "eat"?', options: ['ate', 'eated', 'eaten', 'eating'], answer: [0], explain: 'Eat - ate - eaten.' },
                    { diff: 'pro', q: 'Choose the correct sentence:', options: ['He does not like coffee.', 'He do not like coffee.', 'He not likes coffee.', 'He does not likes coffee.'], answer: [0], explain: 'After "does not", use the base verb.' },
                    { diff: 'pro', q: 'Choose the correct comparative form of "good":', options: ['better', 'gooder', 'more good', 'best'], answer: [0], explain: 'Good - better - best is irregular.' },
                    { diff: 'challenge', q: 'Choose the correct sentence (present perfect):', options: ['I have lived here for five years.', 'I live here for five years.', 'I am living here for five years.', 'I lived here for five years ago.'], answer: [0], explain: 'Present perfect with "for" expresses duration up to now.' },
                    { diff: 'challenge', q: 'Choose the correct question form:', options: ['Where did you go last night?', 'Where you did go last night?', 'Where did you went last night?', 'Where do you went last night?'], answer: [0], explain: 'Wh- + did + subject + base verb.' }
                ],
                multiple: [
                    { diff: 'basic', q: 'Select all the colors.', options: ['red', 'blue', 'seven', 'green'], answer: [0, 1, 3], explain: '"Seven" is a number, not a color.' },
                    { diff: 'basic', q: 'Select all the days of the week.', options: ['Monday', 'Friday', 'Winter', 'Sunday'], answer: [0, 1, 3], explain: '"Winter" is a season.' },
                    { diff: 'pro', q: 'Select all the sentences in the past tense.', options: ['I visited my grandmother.', 'She was tired.', 'They are eating.', 'We watched a movie.'], answer: [0, 1, 3], explain: 'The third sentence is present continuous.' },
                    { diff: 'pro', q: 'Select all the correct plurals.', options: ['boxes', 'mice', 'sheeps', 'children'], answer: [0, 1, 3], explain: 'The plural of "sheep" is "sheep".' },
                    { diff: 'challenge', q: 'Select all the words that are prepositions.', options: ['in', 'under', 'quickly', 'between'], answer: [0, 1, 3], explain: '"Quickly" is an adverb.' },
                    { diff: 'challenge', q: 'Select all the sentences that are grammatically correct.', options: ['She has been to Japan twice.', 'He can swim very well.', 'They is my friends.', 'I am looking forward to seeing you.'], answer: [0, 1, 3], explain: '"They is" should be "They are".' }
                ]
            },
            tf: [
                { diff: 'basic', q: '「他不但會彈琴，而且會畫畫。」這句話使用了「不但……而且……」的關聯詞。', options: ['是', '非'], answer: [0], explain: '「不但……而且……」表示遞進關係，是常見的關聯詞。' },
                { diff: 'basic', q: '「這本書很有趣」中的「很有趣」是在說明「這本書」怎麼樣。', options: ['是', '非'], answer: [0], explain: '「很有趣」是表語，用來說明主語「這本書」的性質。' },
                { diff: 'pro', q: '「妹妹的臉紅得像蘋果」使用了譬喻修辭。', options: ['是', '非'], answer: [0], explain: '用「像」把臉比喻成蘋果，屬譬喻。' },
                { diff: 'pro', q: '「請你把窗戶關上。」句末的標點應該是問號。', options: ['是', '非'], answer: [1], explain: '這是祈使句，語氣是請求，句末用句號。' },
                { diff: 'challenge', q: '「這件事讓他耿耿於懷」的「耿耿於懷」表示他已經放下了。', options: ['是', '非'], answer: [1], explain: '「耿耿於懷」指心中有事不能忘懷，與「放下」相反。' },
                { diff: 'challenge', q: '「與其抱怨，不如行動」前後兩句的關係是選擇。', options: ['是', '非'], answer: [0], explain: '「與其……不如……」表示在兩者之間做選擇。' }
            ],
            single: [
                { diff: 'basic', q: '「櫃子裡放著一本書」的「一本」是哪一類詞？', options: ['量詞', '名詞', '動詞', '副詞'], answer: [0], explain: '「本」是計算書本單位的量詞。' },
                { diff: 'basic', q: '下列哪一個詞語最適合形容「夏天的太陽」？', options: ['炎熱', '寒冷', '涼爽', '潮溼'], answer: [0], explain: '夏天的太陽令人感到炎熱。' },
                { diff: 'pro', q: '「一葉知秋」的意思是什麼？', options: ['由小地方推知大趨勢', '秋天只有一片葉子', '樹葉掉光了', '秋天很短'], answer: [0], explain: '「一葉知秋」比喻從細微的跡象推知事物的發展。' },
                { diff: 'pro', q: '「他做事總是拖泥帶水」的「拖泥帶水」是什麼意思？', options: ['做事不乾脆', '弄得很髒', '很會游泳', '慢慢走路'], answer: [0], explain: '「拖泥帶水」形容做事不俐落。' },
                { diff: 'challenge', q: '「書山有路勤為徑」這句話主要勉勵我們什麼？', options: ['勤奮向學', '愛護山林', '努力運動', '節省用錢'], answer: [0], explain: '此句勉人勤讀，學問之路要靠勤奮。' },
                { diff: 'challenge', q: '「目不暇給」最適合用在什麼情況？', options: ['景物太多來不及看', '眼睛很累', '看不清楚', '時間不夠'], answer: [0], explain: '「目不暇給」形容美好的事物太多，來不及一一觀看。' }
            ],
            multiple: [
                { diff: 'basic', q: '下列哪些句子有主語和謂語？(可多選)', options: ['花開了。', '小鳥唱歌。', '很快。', '在教室裡。'], answer: [0, 1], explain: '前兩句有完整的主語與謂語；後兩者只是詞組。' },
                { diff: 'basic', q: '下列哪些是「疊字詞」？(可多選)', options: ['慢慢', '高高興興', '跑步', '紅通通'], answer: [0, 1, 3], explain: '「慢慢」「高高興興」「紅通通」都是疊字；「跑步」不是。' },
                { diff: 'pro', q: '下列哪些成語和「做事果斷」有關？(可多選)', options: ['當機立斷', '拖泥帶水', '斬釘截鐵', '猶豫不決'], answer: [0, 2], explain: '「當機立斷」「斬釘截鐵」表示果斷；其餘為反義。' },
                { diff: 'pro', q: '下列哪些句子使用了「誇飾」？(可多選)', options: ['他的聲音大到把屋頂掀了', '我餓得可以吃下一頭牛', '他慢慢地走過來', '她笑得很開心'], answer: [0, 1], explain: '前兩句刻意誇大；後兩句是一般敘述。' },
                { diff: 'challenge', q: '下列哪些屬於「說明文」常見的寫作方式？(可多選)', options: ['舉例', '比較', '分類', '押韻'], answer: [0, 1, 2], explain: '說明文常用舉例、比較、分類；押韻不是必要方式。' },
                { diff: 'challenge', q: '下列哪些詞語帶有「貶義」？(可多選)', options: ['見風轉舵', '同心協力', '投機取巧', '精益求精'], answer: [0, 2], explain: '「見風轉舵」「投機取巧」為貶義；其餘為褒義。' }
            ]
        },
        {
            scope: 6, from: 6, to: 7, title: '高年級',
            sci: {
                tf: [
                    { diff: 'basic', q: '地球繞著太陽公轉，同時也在自轉。', options: ['是', '非'], answer: [0], explain: '自轉造成晝夜，公轉造成四季。' },
                    { diff: 'basic', q: '月亮本身會發光。', options: ['是', '非'], answer: [1], explain: '月亮反射太陽的光，本身不發光。' },
                    { diff: 'pro', q: '槓桿原理中，施力臂越長越省力。', options: ['是', '非'], answer: [0], explain: '施力臂越長，所需施力越小。' },
                    { diff: 'pro', q: '熱會由溫度低的地方傳到溫度高的地方。', options: ['是', '非'], answer: [1], explain: '熱由高溫流向低溫。' },
                    { diff: 'challenge', q: '相同的質量下，體積越小的物體密度越大。', options: ['是', '非'], answer: [0], explain: '密度＝質量÷體積，質量固定時體積越小密度越大。' },
                    { diff: 'challenge', q: '酸鹼中和會產生鹽和水，且通常會放熱。', options: ['是', '非'], answer: [0], explain: '酸與鹼反應生成鹽與水，並伴隨放熱。' }
                ],
                single: [
                    { diff: 'basic', q: '一年之中晝夜長短會改變，主要原因是什麼？', options: ['地球公轉與地軸傾斜', '地球自轉', '月球繞地球', '太陽變大'], answer: [0], explain: '地軸傾斜加上公轉，造成晝夜長短與四季變化。' },
                    { diff: 'basic', q: '下列哪一種動物有脊椎？', options: ['青蛙', '蚯蚓', '蝸牛', '水母'], answer: [0], explain: '青蛙是脊椎動物，其餘為無脊椎動物。' },
                    { diff: 'pro', q: '下列哪一種是化學變化？', options: ['鐵生鏽', '冰融化', '紙撕破', '水沸騰'], answer: [0], explain: '生鏽產生新物質，是化學變化。' },
                    { diff: 'pro', q: '為什麼我們可以看到物體？', options: ['物體反射的光進入眼睛', '眼睛發出光照射物體', '物體自己發光', '空氣會發光'], answer: [0], explain: '眼睛接收物體反射（或發出）的光才能看見。' },
                    { diff: 'challenge', q: '把一顆球往上拋，球到達最高點時速度為何？', options: ['瞬間為零', '最大', '與初速相同', '等於重力'], answer: [0], explain: '最高點時垂直速度暫時為零。' },
                    { diff: 'challenge', q: '下列哪一項最適合用來表示「物質受熱膨脹」？', options: ['鐵軌留縫隙', '電線垂掛', '橋面伸縮縫', '以上皆是'], answer: [3], explain: '三者都是為了因應熱脹冷縮而設計。' }
                ],
                multiple: [
                    { diff: 'basic', q: '下列哪些屬於太陽系的成員？(可多選)', options: ['地球', '火星', '太陽', '北極星'], answer: [0, 1, 2], explain: '北極星不屬於太陽系。' },
                    { diff: 'basic', q: '下列哪些是節能減碳的做法？(可多選)', options: ['隨手關燈', '多搭乘大眾運輸', '冷氣設定在 26-28 度', '電器長期待機'], answer: [0, 1, 2], explain: '電器待機仍耗電，應拔插頭或關閉電源。' },
                    { diff: 'pro', q: '下列哪些現象和空氣有關？(可多選)', options: ['風吹動樹葉', '氣球被吹大', '壓縮空氣推動活塞', '影子變長'], answer: [0, 1, 2], explain: '影子變長與光線角度有關，與空氣無直接關係。' },
                    { diff: 'pro', q: '關於植物的構造，下列哪些正確？(可多選)', options: ['根吸收水分與礦物質', '莖運輸水分', '葉行光合作用', '花的主要功能是吸收養分'], answer: [0, 1, 2], explain: '花的主要功能是繁殖。' },
                    { diff: 'challenge', q: '下列哪些方法可以加快溶解速度？(可多選)', options: ['加熱', '攪拌', '把顆粒磨碎', '把水倒掉'], answer: [0, 1, 2], explain: '加熱、攪拌、磨碎都能加快溶解。' },
                    { diff: 'challenge', q: '關於電流，下列哪些敘述正確？(可多選)', options: ['需要形成通路', '電池提供電壓', '串聯時燈泡越多越亮', '電線斷了就不導電'], answer: [0, 1, 3], explain: '串聯時燈泡越多，每個燈泡越暗。' }
                ]
            },
            soc: {
                tf: [
                    { diff: 'basic', q: '台灣的氣候大致以北回歸線為界，分為熱帶與副熱帶。', options: ['是', '非'], answer: [0], explain: '北回歸線通過嘉義與花蓮，是氣候分界。' },
                    { diff: 'basic', q: '法律一旦公布，任何人都必須遵守。', options: ['是', '非'], answer: [0], explain: '法律對全體人民一體適用。' },
                    { diff: 'pro', q: '台灣的經濟發展早期以農業為主，後來轉向工業與服務業。', options: ['是', '非'], answer: [0], explain: '台灣經歷了農業、工業到服務業的轉型。' },
                    { diff: 'pro', q: '遷徙是指人們為了工作或生活而移動到其他地方。', options: ['是', '非'], answer: [0], explain: '遷徙包含移入與移出，原因多為經濟、政治或環境。' },
                    { diff: 'challenge', q: '全球化的過程中，各地的文化會變得更完全一致，沒有差異。', options: ['是', '非'], answer: [1], explain: '全球化也會引發在地文化的反彈與融合，並非完全一致。' },
                    { diff: 'challenge', q: '憲法是國家的最高法律，其他法律不得與它牴觸。', options: ['是', '非'], answer: [0], explain: '憲法具最高效力，法律不得違憲。' }
                ],
                single: [
                    { diff: 'basic', q: '台灣人口最密集的地區多半位於何處？', options: ['西部平原與都會區', '中央山脈', '東部峭壁', '離島'], answer: [0], explain: '西部平原交通與產業發達，人口密集。' },
                    { diff: 'basic', q: '下列哪一項是中央政府負責的事務？', options: ['國防與外交', '垃圾清運', '社區活動中心', '地方公園維護'], answer: [0], explain: '國防與外交屬中央層級；其餘多為地方事務。' },
                    { diff: 'pro', q: '下列哪一項最能促進性別平等？', options: ['同工同酬', '限制特定性別就業', '依性別分派家務', '只讓一種性別受教育'], answer: [0], explain: '同工同酬是性別平等的基本要求。' },
                    { diff: 'pro', q: '「永續發展」強調的是什麼？', options: ['滿足當代需求且不損害後代', '盡量開發所有資源', '停止一切經濟活動', '只保護野生動物'], answer: [0], explain: '永續發展兼顧經濟、社會與環境，並顧及後代。' },
                    { diff: 'challenge', q: '下列哪一項是媒體識讀的核心能力？', options: ['查證訊息來源與辨識立場', '全部相信', '只看標題', '只分享不查證'], answer: [0], explain: '查證來源、辨識立場與意圖是媒體識讀的核心。' },
                    { diff: 'challenge', q: '台灣的全民健康保險制度主要目的為何？', options: ['讓民眾就醫不因經濟能力而受限', '增加醫院收入', '限制就醫次數', '只保障特定職業'], answer: [0], explain: '健保透過風險分攤，保障全民就醫權益。' }
                ],
                multiple: [
                    { diff: 'basic', q: '下列哪些是地方政府的服務？(可多選)', options: ['垃圾清運', '道路養護', '公立學校設立', '發行護照'], answer: [0, 1, 2], explain: '護照由中央機關核發。' },
                    { diff: 'basic', q: '下列哪些是台灣的重要產業？(可多選)', options: ['半導體', '精緻農業', '觀光', '太空採礦'], answer: [0, 1, 2], explain: '台灣目前沒有太空採礦產業。' },
                    { diff: 'pro', q: '下列哪些行為符合法治精神？(可多選)', options: ['遵守法律', '依法申請許可', '以暴力解決糾紛', '服從法院判決'], answer: [0, 1, 3], explain: '以暴力解決糾紛是違法行為。' },
                    { diff: 'pro', q: '下列哪些是文化多樣性的表現？(可多選)', options: ['不同族群的語言', '不同的節慶', '不同的飲食習慣', '統一一種生活方式'], answer: [0, 1, 2], explain: '文化多樣性強調差異並存，而非統一。' },
                    { diff: 'challenge', q: '關於公民參與，下列哪些敘述正確？(可多選)', options: ['可透過投票表達意見', '可參與公共政策討論', '可監督政府施政', '只有官員才能參與公共事務'], answer: [0, 1, 2], explain: '公共事務人人可參與，不限官員。' },
                    { diff: 'challenge', q: '下列哪些屬於經濟活動中的「消費」？(可多選)', options: ['買一杯飲料', '搭公車付車資', '到餐廳用餐', '在工廠組裝零件'], answer: [0, 1, 2], explain: '組裝零件屬於生產行為。' }
                ]
            },
            eng: {
                tf: [
                    { diff: 'basic', q: '"Would you like some tea?" is a polite offer.', options: ['True', 'False'], answer: [0], explain: '"Would you like" is a polite way to offer something.' },
                    { diff: 'basic', q: 'A verb describes an action or a state.', options: ['True', 'False'], answer: [0], explain: 'Verbs express actions (run) or states (be, know).' },
                    { diff: 'pro', q: '"She is taller than me" uses a comparative form correctly.', options: ['True', 'False'], answer: [0], explain: 'The comparative of "tall" is "taller".' },
                    { diff: 'pro', q: 'We say "I have been to Japan last year".', options: ['True', 'False'], answer: [1], explain: 'With a past time expression use the past simple: "I went".' },
                    { diff: 'challenge', q: '"The book which I bought is interesting" is a correct relative clause.', options: ['True', 'False'], answer: [0], explain: '"Which" refers to the thing "the book".' },
                    { diff: 'challenge', q: 'A passive sentence puts the doer of the action first.', options: ['True', 'False'], answer: [1], explain: 'Passive voice puts the receiver first: "The window was broken".' }
                ],
                single: [
                    { diff: 'basic', q: 'Choose the correct word: "There ____ some milk in the fridge."', options: ['is', 'are', 'have', 'has'], answer: [0], explain: '"Milk" is uncountable, so use "is".' },
                    { diff: 'basic', q: 'What does "borrow" mean?', options: ['借入', '借出', '買下', '丟掉'], answer: [0], explain: '"Borrow" means to take and use something temporarily.' },
                    { diff: 'pro', q: 'Choose the correct sentence:', options: ['I have never seen a whale.', 'I never have seen a whale.', 'I have seen never a whale.', 'I never saw have a whale.'], answer: [0], explain: 'Adverbs like "never" go between have and the past participle.' },
                    { diff: 'pro', q: 'Choose the correct word: "If I ____ you, I would apologize."', options: ['were', 'am', 'was being', 'will be'], answer: [0], explain: 'Second conditional uses "were" for all subjects.' },
                    { diff: 'challenge', q: 'Choose the correct reported speech: He said, "I am tired."', options: ['He said that he was tired.', 'He said that I am tired.', 'He said that he is tired.', 'He said that I was tired.'], answer: [0], explain: 'In reported speech, pronouns and tenses shift back.' },
                    { diff: 'challenge', q: 'Choose the correct sentence (gerund as subject):', options: ['Swimming is good exercise.', 'Swim is good exercise.', 'To swimming is good exercise.', 'Swims is good exercise.'], answer: [0], explain: 'A gerund can act as the subject of a sentence.' }
                ],
                multiple: [
                    { diff: 'basic', q: 'Select all the school subjects.', options: ['math', 'science', 'apple', 'history'], answer: [0, 1, 3], explain: '"Apple" is food, not a school subject.' },
                    { diff: 'basic', q: 'Select all the words that describe feelings.', options: ['happy', 'angry', 'table', 'nervous'], answer: [0, 1, 3], explain: '"Table" is a thing, not a feeling.' },
                    { diff: 'pro', q: 'Select all the sentences with a modal verb.', options: ['You must wear a helmet.', 'She can speak three languages.', 'They went home.', 'We should recycle.'], answer: [0, 1, 3], explain: 'The third sentence has no modal verb.' },
                    { diff: 'pro', q: 'Select all the correct verb forms after "to".', options: ['to go', 'to eating', 'to study', 'to be'], answer: [0, 2, 3], explain: 'After "to" (infinitive) use the base verb: "to eat".' },
                    { diff: 'challenge', q: 'Select all the sentences in the passive voice.', options: ['The cake was eaten by the children.', 'English is spoken here.', 'She wrote a letter.', 'The window has been fixed.'], answer: [0, 1, 3], explain: 'The third sentence is active voice.' },
                    { diff: 'challenge', q: 'Select all the linking words that show contrast.', options: ['however', 'although', 'because', 'nevertheless'], answer: [0, 1, 3], explain: '"Because" shows cause, not contrast.' }
                ]
            },
            tf: [
                { diff: 'basic', q: '「他寧可走路，也不願遲到。」這句話表達的是取捨。', options: ['是', '非'], answer: [0], explain: '「寧可……也不……」表示在兩者中做出取捨。' },
                { diff: 'basic', q: '「既然你已經盡力了，就不必自責。」「既然」表示條件已經成立。', options: ['是', '非'], answer: [0], explain: '「既然」用於提出已成事實的前提。' },
                { diff: 'pro', q: '「他的話像一把刀，刺進我的心裡」只使用了譬喻，沒有誇飾的成分。', options: ['是', '非'], answer: [1], explain: '此句同時帶有誇飾的效果，說法不夠嚴謹。' },
                { diff: 'pro', q: '「這件事說來話長」表示事情很單純、可以簡短說明。', options: ['是', '非'], answer: [1], explain: '「說來話長」指事情複雜，不是三言兩語能講完。' },
                { diff: 'challenge', q: '「寓言的寓意往往寄託在故事的最後」—這句話的「寄託」是動詞。', options: ['是', '非'], answer: [0], explain: '「寄託」在此作動詞，表示把意思依附在故事中。' },
                { diff: 'challenge', q: '「不恥下問」的「下」指的是地位比自己低的人。', options: ['是', '非'], answer: [0], explain: '「下問」指向地位或學識不如自己的人請教。' }
            ],
            single: [
                { diff: 'basic', q: '「躊躇」的意思最接近下列哪一個詞？', options: ['猶豫', '果斷', '迅速', '愉快'], answer: [0], explain: '「躊躇」表示拿不定主意，與「猶豫」相近。' },
                { diff: 'basic', q: '「這幅畫栩栩如生」的「栩栩如生」是用來形容什麼？', options: ['畫得很逼真', '畫得很大', '畫得很舊', '畫得很貴'], answer: [0], explain: '「栩栩如生」形容形象生動逼真，像活的一樣。' },
                { diff: 'pro', q: '「鍥而不捨」的「鍥」是什麼意思？', options: ['雕刻', '丟棄', '停止', '尋找'], answer: [0], explain: '「鍥」是雕刻；「鍥而不捨」指不斷雕刻下去，比喻堅持不懈。' },
                { diff: 'pro', q: '下列哪一句的「之」字用法和其他三句不同？', options: ['學而時習之', '愛蓮之出淤泥而不染', '永州之野產異蛇', '以刀劈狼首，又數刀斃之'], answer: [1], explain: '第二句的「之」用在主謂之間，取消句子獨立性；其餘為代詞或結構助詞。' },
                { diff: 'challenge', q: '「峰迴路轉」除了字面意思，還常用來比喻什麼？', options: ['事情出現轉機', '山路很陡', '風景很美', '走錯方向'], answer: [0], explain: '「峰迴路轉」常比喻事情有了新的轉折或轉機。' },
                { diff: 'challenge', q: '「他這番話可謂一針見血」的「一針見血」是什麼意思？', options: ['說話直指要害', '說話很簡短', '說話很客氣', '說話很傷人'], answer: [0], explain: '「一針見血」比喻言論簡潔而能切中要害。' }
            ],
            multiple: [
                { diff: 'basic', q: '下列哪些是「記敘文」的要素？(可多選)', options: ['人物', '時間', '地點', '押韻'], answer: [0, 1, 2], explain: '記敘文重在人事時地物；押韻不是必要要素。' },
                { diff: 'basic', q: '下列哪些詞語可以用來形容「態度」？(可多選)', options: ['誠懇', '敷衍', '認真', '紅色'], answer: [0, 1, 2], explain: '前三個詞可形容態度；「紅色」形容顏色。' },
                { diff: 'pro', q: '下列哪些句子使用了「映襯」修辭？(可多選)', options: ['他雖窮，卻很快樂', '失敗為成功之母', '天很黑，路很遠', '風景很美'], answer: [0, 2], explain: '映襯要並列相對的事物；後兩者沒有對比關係。' },
                { diff: 'pro', q: '下列哪些成語與「堅持不懈」意思相近？(可多選)', options: ['鍥而不捨', '半途而廢', '持之以恆', '有始無終'], answer: [0, 2], explain: '「鍥而不捨」「持之以恆」表示堅持；其餘為反義。' },
                { diff: 'challenge', q: '下列哪些是「議論文」常用的論證方式？(可多選)', options: ['舉例論證', '正反論證', '因果論證', '押韻論證'], answer: [0, 1, 2], explain: '議論文常用舉例、正反、因果等論證；「押韻論證」不存在。' },
                { diff: 'challenge', q: '下列哪些文句使用了「引用」？(可多選)', options: ['孔子說：「學而不思則罔。」', '俗話說：「羅馬不是一天造成的。」', '我喜歡看書。', '今天天氣很好。'], answer: [0, 1], explain: '引用須明白引出他人的話或名言；後兩句是一般敘述。' }
            ]
        },
        {
            scope: 8, from: 8, to: 10, title: '國中',
            sci: {
                tf: [
                    { diff: 'basic', q: '細胞是生物體構造與功能的基本單位。', options: ['是', '非'], answer: [0], explain: '除病毒外，生物體都由細胞組成。' },
                    { diff: 'basic', q: '原子是元素能保持其化學性質的最小單位。', options: ['是', '非'], answer: [0], explain: '原子是化學變化中最小的粒子。' },
                    { diff: 'pro', q: '在定溫下，氣體的壓力與體積成正比。', options: ['是', '非'], answer: [1], explain: '定溫下壓力與體積成反比（波以耳定律）。' },
                    { diff: 'pro', q: '力可以改變物體的運動狀態或形狀。', options: ['是', '非'], answer: [0], explain: '力能改變速度、方向或使物體變形。' },
                    { diff: 'challenge', q: '質量守恆定律是指化學反應前後原子總數不變。', options: ['是', '非'], answer: [0], explain: '化學反應只是原子重新排列，總數不變。' },
                    { diff: 'challenge', q: '同一物體在月球上的質量比在地球上小。', options: ['是', '非'], answer: [1], explain: '質量不隨地點改變，改變的是重量。' }
                ],
                single: [
                    { diff: 'basic', q: '下列哪一項是混合物？', options: ['空氣', '純水', '氧氣', '食鹽'], answer: [0], explain: '空氣由多種氣體混合而成。' },
                    { diff: 'basic', q: '植物行光合作用主要在哪個胞器進行？', options: ['葉綠體', '粒線體', '細胞核', '細胞壁'], answer: [0], explain: '葉綠體含葉綠素，是光合作用的場所。' },
                    { diff: 'pro', q: '下列哪一種變化是物理變化？', options: ['水結冰', '木材燃燒', '鐵生鏽', '食物腐敗'], answer: [0], explain: '水結冰只改變狀態，沒有產生新物質。' },
                    { diff: 'pro', q: '下列哪一項是牛頓第三運動定律的例子？', options: ['火箭噴氣向前推進', '球滾動後停下', '物體自由落下', '彈簧被拉長'], answer: [0], explain: '作用力與反作用力大小相等、方向相反。' },
                    { diff: 'challenge', q: '下列哪一項敘述符合「擴散作用」？', options: ['香水味道在室內散開', '水從高處流下', '鐵釘被磁鐵吸引', '燈泡發光'], answer: [0], explain: '粒子由高濃度往低濃度移動即為擴散。' },
                    { diff: 'challenge', q: '下列哪一項最適合用來檢驗氧氣？', options: ['插入點燃的線香會復燃', '使澄清石灰水變混濁', '使藍色石蕊試紙變紅', '有爆炸聲'], answer: [0], explain: '氧氣助燃，能讓餘燼復燃。' }
                ],
                multiple: [
                    { diff: 'basic', q: '下列哪些是細胞的構造？(可多選)', options: ['細胞膜', '細胞核', '細胞質', '岩石'], answer: [0, 1, 2], explain: '岩石不是細胞構造。' },
                    { diff: 'basic', q: '下列哪些是可再生能源？(可多選)', options: ['太陽能', '風力', '水力', '石油'], answer: [0, 1, 2], explain: '石油是化石燃料，用盡難以短期補充。' },
                    { diff: 'pro', q: '下列哪些因素會影響反應速率？(可多選)', options: ['溫度', '濃度', '接觸面積', '容器的顏色'], answer: [0, 1, 2], explain: '容器顏色不影響化學反應速率。' },
                    { diff: 'pro', q: '關於生態系，下列哪些敘述正確？(可多選)', options: ['生產者能行光合作用', '消費者直接或間接依賴生產者', '分解者分解遺體與排泄物', '能量循環使用不會散失'], answer: [0, 1, 2], explain: '能量會以熱的形式散失，不會完全循環。' },
                    { diff: 'challenge', q: '下列哪些是「慣性」的例子？(可多選)', options: ['公車突然煞車時乘客前傾', '用力甩動傘上的水滴', '靜止的球被踢後滾動', '石頭沉入水中'], answer: [0, 1], explain: '後兩者與力及浮力有關，不是慣性。' },
                    { diff: 'challenge', q: '下列哪些關於酸鹼的敘述正確？(可多選)', options: ['酸性溶液使藍色石蕊試紙變紅', '鹼性溶液使紅色石蕊試紙變藍', 'pH 值越小酸性越強', 'pH 值越大酸性越強'], answer: [0, 1, 2], explain: 'pH 越大越偏鹼性。' }
                ]
            },
            soc: {
                tf: [
                    { diff: 'basic', q: '台灣的歷史發展與其海洋地理位置密切相關。', options: ['是', '非'], answer: [0], explain: '台灣位居東亞航線要衝，貿易與移民頻繁。' },
                    { diff: 'basic', q: '民主國家的政府權力通常分為行政、立法、司法三部分。', options: ['是', '非'], answer: [0], explain: '三權分立可互相制衡，避免權力過度集中。' },
                    { diff: 'pro', q: '國際組織的成員一定是主權國家。', options: ['是', '非'], answer: [1], explain: '部分國際組織也接受地區或非政府組織參與。' },
                    { diff: 'pro', q: '市場經濟中，價格主要由供給與需求共同決定。', options: ['是', '非'], answer: [0], explain: '供給與需求共同決定均衡價格。' },
                    { diff: 'challenge', q: '文化全球化只會造成單一文化，不會產生新的混合文化。', options: ['是', '非'], answer: [1], explain: '全球化常產生混雜與再創造的新文化形式。' },
                    { diff: 'challenge', q: '憲法保障的人民權利，在特定條件下可以依法限制。', options: ['是', '非'], answer: [0], explain: '為維護公共利益或他人權利，得依法律限制。' }
                ],
                single: [
                    { diff: 'basic', q: '下列哪一項是台灣的中央立法機關？', options: ['立法院', '行政院', '司法院', '監察院'], answer: [0], explain: '立法院負責制定法律與審查預算。' },
                    { diff: 'basic', q: '下列哪一項屬於「機會成本」的概念？', options: ['選擇一樣東西所放棄的其他選項中價值最高者', '商品的定價', '銀行的利息', '政府的稅收'], answer: [0], explain: '機會成本是做出選擇時所放棄的最佳替代方案。' },
                    { diff: 'pro', q: '下列哪一項最能說明「供需法則」？', options: ['需求增加而供給不變時價格上升', '價格與供需無關', '供給增加價格一定上升', '需求下降價格上升'], answer: [0], explain: '供給不變、需求增加會推升價格。' },
                    { diff: 'pro', q: '下列哪一項是國際貿易中「比較利益」的概念？', options: ['各國生產自己機會成本較低的產品', '各國生產所有產品', '進口越多越好', '只出口不進口'], answer: [0], explain: '分工生產機會成本較低的產品，雙方都能受益。' },
                    { diff: 'challenge', q: '下列哪一項最能保障人民的司法救濟權？', options: ['人民可以依法提起訴訟', '警察可以直接判決', '行政機關可任意處罰', '媒體可以定罪'], answer: [0], explain: '司法救濟須由法院依法審判。' },
                    { diff: 'challenge', q: '下列哪一項是「外部成本」的例子？', options: ['工廠排放廢水使下游居民受害', '工廠支付員工薪水', '工廠購買原料', '工廠繳納營業稅'], answer: [0], explain: '外部成本是未由生產者負擔而由他人承受的成本。' }
                ],
                multiple: [
                    { diff: 'basic', q: '下列哪些是中央政府負責的事務？(可多選)', options: ['國防', '外交', '發行貨幣', '社區清潔'], answer: [0, 1, 2], explain: '社區清潔屬地方事務。' },
                    { diff: 'basic', q: '下列哪些是人民的基本權利？(可多選)', options: ['言論自由', '受國民教育', '人身自由', '任意侵占他人財產'], answer: [0, 1, 2], explain: '侵占他人財產是違法行為，不是權利。' },
                    { diff: 'pro', q: '下列哪些屬於「社會規範」？(可多選)', options: ['法律', '風俗習慣', '道德', '個人的偏好'], answer: [0, 1, 2], explain: '個人偏好不具社會共同約束力。' },
                    { diff: 'pro', q: '下列哪些是永續發展要兼顧的面向？(可多選)', options: ['經濟發展', '社會公平', '環境保護', '資源無限使用'], answer: [0, 1, 2], explain: '永續發展反對資源無限使用的假設。' },
                    { diff: 'challenge', q: '下列哪些做法有助於縮小城鄉差距？(可多選)', options: ['改善偏鄉交通', '增設數位學習資源', '鼓勵青年返鄉就業', '集中資源於都會區'], answer: [0, 1, 2], explain: '集中資源於都會區會擴大差距。' },
                    { diff: 'challenge', q: '關於全球化，下列哪些敘述正確？(可多選)', options: ['資金與商品跨國流動增加', '跨國企業影響力上升', '可能擴大貧富差距', '各國完全失去自主性'], answer: [0, 1, 2], explain: '各國仍保有政策自主空間，並非完全失去自主性。' }
                ]
            },
            eng: {
                tf: [
                    { diff: 'basic', q: '"Despite the rain, we went out" means the rain did not stop us.', options: ['True', 'False'], answer: [0], explain: '"Despite" introduces a contrast that did not prevent the action.' },
                    { diff: 'basic', q: 'A phrasal verb is a verb combined with a particle, e.g. "give up".', options: ['True', 'False'], answer: [0], explain: 'Phrasal verbs combine a verb with a particle and often have an idiomatic meaning.' },
                    { diff: 'pro', q: '"Not only did he apologize, but he also paid" uses inversion correctly.', options: ['True', 'False'], answer: [0], explain: 'After "not only" at the start, the subject and auxiliary invert.' },
                    { diff: 'pro', q: 'In "I had my car repaired", the speaker repaired the car personally.', options: ['True', 'False'], answer: [1], explain: 'Causative "have something done" means someone else did it.' },
                    { diff: 'challenge', q: '"Having finished the report, she went home" is a participial phrase showing an earlier action.', options: ['True', 'False'], answer: [0], explain: 'The perfect participle shows the first action was completed first.' },
                    { diff: 'challenge', q: 'A defining relative clause can be left out without changing the meaning.', options: ['True', 'False'], answer: [1], explain: 'Removing a defining clause changes the meaning; non-defining clauses are the removable kind.' }
                ],
                single: [
                    { diff: 'basic', q: 'Choose the correct word: "The news ____ surprising."', options: ['is', 'are', 'were being', 'have'], answer: [0], explain: '"News" is uncountable and takes a singular verb.' },
                    { diff: 'basic', q: 'What does "look forward to" mean?', options: ['期待', '回頭看', '照顧', '尋找'], answer: [0], explain: '"Look forward to" means to await something with pleasure.' },
                    { diff: 'pro', q: 'Choose the correct sentence:', options: ['She suggested that we leave early.', 'She suggested that we left early.', 'She suggested us to leave early.', 'She suggested we leaving early.'], answer: [0], explain: 'After "suggest that", use the base form of the verb.' },
                    { diff: 'pro', q: 'Choose the correct word: "He is used to ____ up early."', options: ['getting', 'get', 'got', 'gets'], answer: [0], explain: '"Be used to" is followed by a gerund.' },
                    { diff: 'challenge', q: 'Choose the correct sentence (third conditional):', options: ['If I had studied, I would have passed.', 'If I studied, I would have passed.', 'If I had studied, I would pass.', 'If I study, I would have passed.'], answer: [0], explain: 'Third conditional: if + had + p.p., would have + p.p.' },
                    { diff: 'challenge', q: 'Choose the correct sentence with an inversion:', options: ['Never have I seen such a sight.', 'Never I have seen such a sight.', 'Never have seen I such a sight.', 'Never I saw such a sight.'], answer: [0], explain: 'A negative adverb at the front triggers inversion.' }
                ],
                multiple: [
                    { diff: 'basic', q: 'Select all the formal words for writing an essay.', options: ['furthermore', 'moreover', 'gonna', 'consequently'], answer: [0, 1, 3], explain: '"Gonna" is informal speech.' },
                    { diff: 'basic', q: 'Select all the words related to the environment.', options: ['pollution', 'recycling', 'conservation', 'homework'], answer: [0, 1, 2], explain: '"Homework" is unrelated to the environment.' },
                    { diff: 'pro', q: 'Select all the sentences that use the present perfect.', options: ['I have finished my homework.', 'She has never been abroad.', 'They arrived yesterday.', 'We have known each other for years.'], answer: [0, 1, 3], explain: 'The third sentence uses the past simple.' },
                    { diff: 'pro', q: 'Select all the transitive verbs in these pairs.', options: ['raise', 'lay', 'rise', 'lie (recline)'], answer: [0, 1], explain: '"Rise" and "lie" are intransitive.' },
                    { diff: 'challenge', q: 'Select all the sentences with a correct conditional.', options: ['If it had not rained, we would have gone hiking.', 'If I were you, I would take the job.', 'If she will come, we will start.', 'Unless you hurry, you will be late.'], answer: [0, 1, 3], explain: 'The third sentence should be "If she comes".' },
                    { diff: 'challenge', q: 'Select all the cohesive devices that introduce a result.', options: ['therefore', 'as a result', 'in contrast', 'consequently'], answer: [0, 1, 3], explain: '"In contrast" signals contrast, not result.' }
                ]
            },
            tf: [
                { diff: 'basic', q: '「他山之石，可以攻玉」比喻借助外力的幫助來改正自己的缺失。', options: ['是', '非'], answer: [0], explain: '比喻借助別人的力量或意見來改正自己的缺點。' },
                { diff: 'basic', q: '「因地制宜」的「因」是「因為」的意思。', options: ['是', '非'], answer: [1], explain: '「因」在此是「依據、順著」，並非「因為」。' },
                { diff: 'pro', q: '「青出於藍」和「冰寒於水」都強調後人勝過前人。', options: ['是', '非'], answer: [0], explain: '兩者都比喻學生勝過老師、後輩超越前輩。' },
                { diff: 'pro', q: '「刻舟求劍」是在讚美一個人做事有恆心。', options: ['是', '非'], answer: [1], explain: '「刻舟求劍」諷刺拘泥舊法、不知變通。' },
                { diff: 'challenge', q: '「君子之過也，如日月之食」的「食」是「蝕」的通假字。', options: ['是', '非'], answer: [0], explain: '「食」通「蝕」，指日蝕月蝕。' },
                { diff: 'challenge', q: '「不以物喜，不以己悲」表達的是隨遇而安的心境。', options: ['是', '非'], answer: [0], explain: '此句表現不因外物與自身遭遇而或喜或悲的胸襟。' }
            ],
            single: [
                { diff: 'basic', q: '「零丁洋裡歎零丁」的「零丁」是指什麼？', options: ['孤苦無依', '水聲', '地名', '零碎'], answer: [0], explain: '「零丁」在此指孤苦無依。' },
                { diff: 'basic', q: '下列哪一個詞語的意思和「潛移默化」最接近？', options: ['耳濡目染', '一成不變', '大張旗鼓', '一蹴可幾'], answer: [0], explain: '「耳濡目染」與「潛移默化」都指不知不覺受影響。' },
                { diff: 'pro', q: '「這種說法未免過於牽強」的「牽強」是什麼意思？', options: ['理由不充分、勉強', '很用力', '很堅強', '很清楚'], answer: [0], explain: '「牽強」指理由不充分而勉強附會。' },
                { diff: 'pro', q: '「他對這件事始終抱持著存疑的態度」的「存疑」是？', options: ['心中保留疑問', '完全相信', '非常生氣', '毫不在乎'], answer: [0], explain: '「存疑」指對某事保留疑問，尚未確定。' },
                { diff: 'challenge', q: '「牡丹之愛，宜乎眾矣」的「宜」應解釋為？', options: ['當然', '適宜', '應該要', '便宜'], answer: [0], explain: '「宜乎」即「當然」，表示推測而肯定的語氣。' },
                { diff: 'challenge', q: '「先天下之憂而憂」的「先」是哪一種用法？', options: ['形容詞作動詞', '名詞', '副詞', '量詞'], answer: [0], explain: '「先」由形容詞轉作動詞，意為「在……之前」。' }
            ],
            multiple: [
                { diff: 'basic', q: '下列哪些是「文言文」常見的語言現象？(可多選)', options: ['通假字', '詞類活用', '倒裝句', '注音符號'], answer: [0, 1, 2], explain: '通假、活用、倒裝都是常見現象；注音符號不是語言現象。' },
                { diff: 'basic', q: '下列哪些詞語可以用來形容「文章寫得很好」？(可多選)', options: ['文筆流暢', '條理分明', '不知所云', '鏗鏘有力'], answer: [0, 1, 3], explain: '「不知所云」指說話或文章雜亂無章讓人聽不懂，是負面評價。' },
                { diff: 'pro', q: '下列哪些句子可作為「論點」的支撐（論據）？(可多選)', options: ['統計數據', '歷史事例', '名人名言', '個人的情緒'], answer: [0, 1, 2], explain: '論據須具客觀性；單純的情緒不是有效論據。' },
                { diff: 'pro', q: '下列哪些作品屬於「遊記」性質？(可多選)', options: ['始得西山宴遊記', '岳陽樓記', '醉翁亭記', '出師表'], answer: [0, 1, 2], explain: '〈出師表〉是奏議文，不是遊記。' },
                { diff: 'challenge', q: '下列哪些屬於「婉曲」修辭？(可多選)', options: ['他已經「往生」了', '「方便」一下（上廁所）', '他跑得比風還快', '「那個」來了（指月事）'], answer: [0, 1, 3], explain: '婉曲是不直接說出；「跑得比風還快」是誇飾。' },
                { diff: 'challenge', q: '關於「借代」修辭，下列哪些正確？(可多選)', options: ['以「絲竹」代音樂', '以「巾幗」代女子', '以「黃髮」代老人', '以「明月」代太陽'], answer: [0, 1, 2], explain: '前三者都是借代；「明月」不能代替太陽。' }
            ]
        }
    ];
    advBands.forEach(band => {
        const tfAdv = band.tf.concat(authored('chinese', band.scope, 'tf'));
        const singleAdv = band.single.concat(authored('chinese', band.scope, 'single'));
        const multipleAdv = band.multiple.concat(authored('chinese', band.scope, 'multiple'));
        for (let g = band.from; g <= band.to; g++) {
            const low = g <= 3;
            const tagAdv = (arr) => arr.map(it => ({
                id: nid('chinese', g, 'x'), zhuyin: low ? zhuyinOf(it.q) : null, scope: band.scope, ...it
            }));
            tagAdv(tfAdv).forEach(it => push('chinese', g, 'tf', { ...it, id: nid('chinese', g, 'tf') }));
            tagAdv(singleAdv).forEach(it => push('chinese', g, 'single', { ...it, id: nid('chinese', g, 'single') }));
            tagAdv(multipleAdv).forEach(it => push('chinese', g, 'multiple', { ...it, id: nid('chinese', g, 'multiple') }));
        }
    });
}

// Expand a hand-authored list to `target` items. `extra` supplies genuinely
// distinct additional items (not surface rewordings) so the pool stays
// discriminating. If `extra` runs short we cycle it, but the authored `extra`
// is always at least as large as the deficit.
function expandVariants(list, target, extra) {
    const out = list.concat(extra || []);
    let v = 0;
    while (out.length < target) {
        out.push((extra && extra[v % extra.length]) || list[v % list.length]);
        v++;
    }
    return out;
}

// Domain tags for the split subjects (Phase 2, 國中): 自然科學 -> 生命科學(life)
// / 物質科學(matter); 社會科 -> 歷史地理(histgeo) / 公民與社會(civics).
// Deterministic keyword classification - a keyword hit wins, otherwise the
// conservative default (matter / histgeo). Verified by phase2_test.js.
const LIFE_KW = ['植物','動物','生物','生命','光合','呼吸作用','細菌','昆蟲','蝴蝶','生態','蚯蚓','榕樹','小狗','青蛙','蝌蚪','種子','發芽','皮膚','羽毛'];
const CIV_KW  = ['公民','交通','規則','遵守','投票','民主','社區','習慣','洗手','火災','公物','政府','公共服務','素養','永續','回收','環境','保護','參與','良好','愛護'];
const sciDom  = q => (LIFE_KW.some(k => q.includes(k)) ? 'life' : 'matter');
const socDom  = q => (CIV_KW.some(k => q.includes(k)) ? 'civics' : 'histgeo');

function buildScience() {

    for (let g = 2; g <= 10; g++) {
        const low = g <= 3; // target grade 2-3 => 國小一、二年級 => needs 注音
        const tf = [
            { diff: 'basic', q: '植物進行光合作用時，主要釋放的氣體是氧氣。', options: ['是', '非'], answer: [0], explain: '光合作用吸收二氧化碳、釋放氧氣。' },
            { diff: 'basic', q: '水在標準大氣壓下加熱到 100°C 會沸騰。', options: ['是', '非'], answer: [0], explain: '標準大氣壓下水的沸點是 100°C。' },
            { diff: 'basic', q: '冰塊融化成水是化學變化。', options: ['是', '非'], answer: [1], explain: '融化只是狀態改變，沒有產生新物質，屬物理變化。' },
            { diff: 'basic', q: '太陽是地球上光和熱的主要來源。', options: ['是', '非'], answer: [0], explain: '太陽提供地球主要的能量來源。' },
            { diff: 'pro', q: '鐵釘生鏽是物理變化，因為鐵還是鐵。', options: ['是', '非'], answer: [1], explain: '生鏽產生氧化鐵，是化學變化。' },
            { diff: 'pro', q: '月相的變化是因為月球繞地球公轉所造成的。', options: ['是', '非'], answer: [0], explain: '月球繞地球公轉，使我們看到被太陽照亮的部分不同，形成月相變化。' },
            { diff: 'pro', q: '聲音可以在真空中傳播。', options: ['是', '非'], answer: [1], explain: '聲音需要介質傳播，真空中無法傳聲。' },
            { diff: 'challenge', q: '質量守恆定律是指化學反應前後，物質的總質量不變。', options: ['是', '非'], answer: [0], explain: '化學反應前後原子種類與數目不變，故質量守恆。' },
            // 生命科學題（增加 life 域題量，供國中分科試卷）
            { diff: 'basic', q: '植物的種子發芽需要水分、空氣與適宜的溫度。', options: ['是', '非'], answer: [0], explain: '種子發芽需要水分、空氣與適當溫度。' },
            { diff: 'pro', q: '青蛙是兩棲類動物，蝌蚪是青蛙的幼體，會用鰓呼吸。', options: ['是', '非'], answer: [0], explain: '蝌蚪生活在水中，用鰓呼吸，之後才長出四肢成為青蛙。' }
        ];
        const single = [
            { diff: 'basic', q: '下列哪一種動物是昆蟲？', options: ['蝴蝶', '蜘蛛', '蚯蚓', '蝸牛'], answer: [0], explain: '昆蟲有六隻腳、身體分三節，蝴蝶符合；蜘蛛有八隻腳。' },
            { diff: 'basic', q: '植物製造養分需要下列哪一項？', options: ['陽光', '黑暗', '鹽水', '沙子'], answer: [0], explain: '光合作用需要陽光、水和二氧化碳。' },
            { diff: 'basic', q: '下列哪一種是天氣現象？', options: ['下雨', '地震', '火山爆發', '潮汐'], answer: [0], explain: '下雨是大氣現象；其餘屬於地質或天文現象。' },
            { diff: 'pro', q: '下列哪一項屬於「化學變化」？', options: ['木材燃燒', '水結成冰', '糖溶於水', '玻璃破碎'], answer: [0], explain: '燃燒產生新物質，屬化學變化；其餘僅狀態或形狀改變。' },
            { diff: 'pro', q: '在等高線地形圖上，等高線越密集代表什麼？', options: ['坡度越陡', '地勢越平', '海拔越低', '河流越長'], answer: [0], explain: '等高線密集表示高度變化劇烈，坡度陡。' },
            { diff: 'pro', q: '下列哪一項是「可再生能源」？', options: ['太陽能', '煤', '石油', '天然氣'], answer: [0], explain: '太陽能可持續補充，屬可再生能源；化石燃料則會耗竭。' },
            // 生命科學題（供國中分科試卷，dom=life）
            { diff: 'basic', q: '下列哪一種動物是兩棲類？', options: ['青蛙', '魚', '麻雀', '蜥蜴'], answer: [0], explain: '青蛙屬兩棲類，幼體蝌蚪在水中生活；魚為魚類、麻雀為鳥類、蜥蜴為爬蟲類。' },
            { diff: 'basic', q: '植物的葉片進行光合作用主要製造什麼？', options: ['養分（葡萄糖）', '泥土', '食鹽', '石頭'], answer: [0], explain: '光合作用以二氧化碳與水製造養分（葡萄糖）並釋放氧氣。' },
            { diff: 'pro', q: '下列哪一項屬於生物體的生長現象？', options: ['種子萌芽長成幼苗', '冰塊融化', '鐵釘生鏽', '石頭風化'], answer: [0], explain: '種子萌芽成幼苗是生物的生長；其餘為非生物的物理或化學變化。' },
            { diff: 'challenge', q: '下列哪一種現象代表細菌正在生長繁殖？', options: ['培養皿中的菌落逐漸變大', '冰塊逐漸變小', '鐵釘逐漸生鏽', '水逐漸蒸發'], answer: [0], explain: '菌落變大是細菌繁殖的結果；其餘為物理變化。' },
            { diff: 'challenge', q: '電路中串聯兩顆燈泡，若其中一顆壞掉，另一顆會如何？', options: ['也熄滅', '更亮', '不變', '閃爍'], answer: [0], explain: '串聯電路只有一條路徑，斷路後整個電路不通。' },
            { diff: 'challenge', q: '下列哪一項最能說明「質量守恆」？', options: ['密閉容器內反應前後總質量不變', '反應後質量一定變小', '反應後質量一定變大', '質量與反應無關'], answer: [0], explain: '密閉系統中反應前後總質量保持不變。' }
        ];
        const multiple = [
            { diff: 'basic', q: '下列哪些屬於生物？(可多選)', options: ['榕樹', '小狗', '石頭', '細菌'], answer: [0, 1, 3], explain: '榕樹、小狗、細菌具有生命現象；石頭不是生物。' },
            { diff: 'basic', q: '下列哪些是植物的構造？(可多選)', options: ['根', '莖', '葉', '翅膀'], answer: [0, 1, 2], explain: '根、莖、葉是植物器官；翅膀是動物構造。' },
            { diff: 'pro', q: '下列哪些屬於「物理變化」？(可多選)', options: ['水結成冰', '乾冰昇華', '鐵釘生鏽', '木材燃燒'], answer: [0, 1], explain: '水結冰與乾冰昇華未產生新物質；生鏽、燃燒為化學變化。' },
            { diff: 'pro', q: '下列哪些是節約能源的做法？(可多選)', options: ['隨手關燈', '搭乘大眾運輸', '冷氣開到最低溫', '使用省電燈具'], answer: [0, 1, 3], explain: '前三項中之第 3 項浪費能源；其餘皆為節能做法。' },
            { diff: 'pro', q: '下列哪些會影響植物生長？(可多選)', options: ['陽光', '水分', '土壤養分', '電視節目'], answer: [0, 1, 2], explain: '陽光、水分與養分是植物生長的要素。' },
            { diff: 'challenge', q: '下列哪些是化學變化？(可多選)', options: ['鐵生鏽', '木材燃燒', '食物腐敗', '冰塊融化'], answer: [0, 1, 2], explain: '前三項產生新物質，屬化學變化；冰塊融化為物理變化。' },
            { diff: 'challenge', q: '下列哪些是可再生能源？(可多選)', options: ['太陽能', '風能', '水力', '煤'], answer: [0, 1, 2], explain: '太陽能、風能、水力可持續補充；煤為化石燃料。' },
            { diff: 'challenge', q: '下列哪些屬於導電體？(可多選)', options: ['銅線', '鐵釘', '橡膠', '石墨'], answer: [0, 1, 3], explain: '銅、鐵、石墨可導電；橡膠是絕緣體。' },
            // 生命科學題（供國中分科試卷，dom=life）
            { diff: 'basic', q: '下列哪些屬於生物？(可多選)', options: ['青苔', '蝸牛', '蜜蜂', '玻璃珠'], answer: [0, 1, 2], explain: '青苔、蝸牛、蜜蜂皆有生命現象；玻璃珠無生命。' },
            { diff: 'pro', q: '下列哪些是動物的特徵？(可多選)', options: ['會生長', '需要養分', '會繁殖', '有固定不變的形狀'], answer: [0, 1, 2], explain: '生長、取食與繁殖是生物共同特徵；形狀固定不變不是生命現象。' }
        ];
        const sciTfExtra = [
            { diff: 'basic', q: '磁鐵的 N 極與 S 極會互相吸引。', options: ['是', '非'], answer: [0], explain: '異極相吸、同極相斥。' },
            { diff: 'basic', q: '植物會行呼吸作用，吸收氧氣、放出二氧化碳。', options: ['是', '非'], answer: [0], explain: '呼吸作用日夜都進行，吸收氧氣放出二氧化碳。' },
            { diff: 'pro', q: '彩虹的形成與光的折射及反射有關。', options: ['是', '非'], answer: [0], explain: '陽光進入水滴後折射、反射再折射，形成彩虹。' },
            { diff: 'challenge', q: '在生態系中，能量會循環利用，不會流失。', options: ['是', '非'], answer: [1], explain: '能量是單向流動的，逐級傳遞時會以熱能形式散失，不會循環。' }
        ];
        const sciSingleExtra = [
            { diff: 'basic', q: '下列哪一種情形最可能看到自己的影子？', options: ['站在路燈下', '在黑暗房間中', '在無光環境下', '閉上眼睛時'], answer: [0], explain: '光被身體遮擋便形成影子，路燈下最容易觀察。' },
            { diff: 'basic', q: '下列哪一項是液體？', options: ['水', '冰塊', '水蒸氣', '石頭'], answer: [0], explain: '水是液體；冰塊是固體，水蒸氣是氣體。' },
            { diff: 'pro', q: '下列哪一項可以減緩地球暖化？', options: ['減少溫室氣體排放', '增加燃煤發電', '大量砍伐森林', '焚燒垃圾'], answer: [0], explain: '減少溫室氣體排放是最直接有效的方式。' },
            { diff: 'challenge', q: '一天中影子最短的時刻大約是什麼時候？', options: ['正午', '清晨', '傍晚', '午夜'], answer: [0], explain: '正午太陽仰角最大，影子最短。' }
        ];
        const sciMulExtra = [
            { diff: 'basic', q: '下列哪些是磁鐵可以吸引的物品？（可多選）', options: ['鐵釘', '迴紋針', '銅板', '鋁箔'], answer: [0, 1], explain: '磁鐵能吸引鐵、鈷、鎳等材質；銅與鋁不被吸引。' },
            { diff: 'pro', q: '下列哪些可以減緩地球暖化？(可多選)', options: ['搭乘大眾運輸', '節約用電', '使用再生能源', '露天焚燒垃圾'], answer: [0, 1, 2], explain: '焚燒垃圾會增加碳排放。' },
            { diff: 'challenge', q: '下列哪些是維護生態環境的做法？(可多選)', options: ['設立保護區', '減少汙染', '外來種放生', '資源回收'], answer: [0, 1, 3], explain: '任意放生外來種會破壞生態平衡。' }
        ];
        const tfAll = expandVariants(tf, 12, sciTfExtra);
        const singleAll = expandVariants(single, 12, sciSingleExtra);
        const multipleAll = expandVariants(multiple, 12, sciMulExtra);
        const tag = arr => arr.map(it => ({ id: nid('science', g, 'x'), zhuyin: low ? zhuyinOf(it.q) : null, ...it, dom: sciDom(it.q) }));
        tag(tfAll).forEach(it => push('science', g, 'tf', { ...it, id: nid('science', g, 'tf'), scope: 2 }));
        tag(singleAll).forEach(it => push('science', g, 'single', { ...it, id: nid('science', g, 'single'), scope: 2 }));
        tag(multipleAll).forEach(it => push('science', g, 'multiple', { ...it, id: nid('science', g, 'multiple'), scope: 2 }));
    }
    // 進階自然（S2 / S4）：原本每個年級同一份，見 buildChinese 的說明。
    advBands.forEach(band => {
        const tfAdv = band.sci.tf.concat(authored('science', band.scope, 'tf'));
        const singleAdv = band.sci.single.concat(authored('science', band.scope, 'single'));
        const multipleAdv = band.sci.multiple.concat(authored('science', band.scope, 'multiple'));
        for (let g = band.from; g <= band.to; g++) {
            const low = g <= 3;
            const tagAdv = (arr) => arr.map(it => ({
                id: nid('science', g, 'x'), zhuyin: low ? zhuyinOf(it.q) : null, scope: band.scope, ...it, dom: sciDom(it.q)
            }));
            tagAdv(tfAdv).forEach(it => push('science', g, 'tf', { ...it, id: nid('science', g, 'tf') }));
            tagAdv(singleAdv).forEach(it => push('science', g, 'single', { ...it, id: nid('science', g, 'single') }));
            tagAdv(multipleAdv).forEach(it => push('science', g, 'multiple', { ...it, id: nid('science', g, 'multiple') }));
        }
    });
}

function buildSocial() {
    for (let g = 2; g <= 10; g++) {
        const low = g <= 3; // target grade 2-3 => 國小一、二年級 => needs 注音
        const tf = [
            { diff: 'basic', q: '臺灣位在環太平洋地震帶上，所以地震頻繁。', options: ['是', '非'], answer: [0], explain: '臺灣位於板塊交界處，地震活動頻繁。' },
            { diff: 'basic', q: '臺灣是一個四面環海的島嶼。', options: ['是', '非'], answer: [0], explain: '臺灣四面環海，是海島型國家。' },
            { diff: 'basic', q: '遵守交通規則只是為了避免被警察處罰。', options: ['是', '非'], answer: [1], explain: '遵守交通規則主要是為了保護自己與他人的安全。' },
            { diff: 'basic', q: '家庭、學校和社區都是我們生活的環境。', options: ['是', '非'], answer: [0], explain: '這些都是我們日常生活的環境。' },
            { diff: 'pro', q: '臺灣的河流大多流短湍急，是因為地形狹長且山脈偏東。', options: ['是', '非'], answer: [0], explain: '中央山脈偏東，河流西長東短，坡陡流急。' },
            { diff: 'pro', q: ' voted 投票是人民參與公共事務的一種方式。', options: ['是', '非'], answer: [0], explain: '投票是民主社會中表達意見與參與決策的方式。' },
            { diff: 'pro', q: '臺灣的氣候完全不受季風影響。', options: ['是', '非'], answer: [1], explain: '臺灣受東北季風與西南季風影響，形成乾溼季差異。' },
            { diff: 'challenge', q: '地圖上的比例尺越大，表示地圖所涵蓋的實際範圍越小。', options: ['是', '非'], answer: [0], explain: '大比例尺地圖細節清楚，但涵蓋範圍較小。' }
        ];
        const single = [
            { diff: 'basic', q: '下列哪一項是臺灣的重要古蹟？', options: ['赤崁樓', '自由女神像', '金字塔', '萬里長城'], answer: [0], explain: '赤崁樓是臺南的重要古蹟。' },
            { diff: 'basic', q: '我們可以從哪一種圖知道方向？', options: ['地圖', '食譜', '樂譜', '帳單'], answer: [0], explain: '地圖上標有方位，可判斷方向。' },
            { diff: 'basic', q: '下列哪一項是良好的公民行為？', options: ['排隊守秩序', '隨地丟垃圾', '破壞公物', '大聲喧嘩'], answer: [0], explain: '排隊守秩序是尊重他人與公共規範的表現。' },
            { diff: 'pro', q: '臺灣人口最集中的區域大致位於何處？', options: ['西部平原', '中央山脈', '東部海岸山脈', '玉山山頂'], answer: [0], explain: '西部平原地勢平坦、交通便利，人口最集中。' },
            { diff: 'pro', q: '下列哪一項最能代表「地方文化特色」？', options: ['當地特有的節慶活動', '外國流行歌曲', '網路遊戲', '進口商品'], answer: [0], explain: '地方節慶與習俗是文化特色的具體展現。' },
            { diff: 'pro', q: '颱風來臨前，下列哪一項準備最恰當？', options: ['準備飲水與糧食', '到海邊觀浪', '爬山活動', '把窗戶打開'], answer: [0], explain: '颱風期間應備妥物資並避免外出。' },
            { diff: 'challenge', q: '臺灣北部冬季常下雨，主要原因是什麼？', options: ['東北季風帶來水氣', '西南季風盛行', '颱風侵襲', '地形抬升不明顯'], answer: [0], explain: '冬季東北季風夾帶水氣，遇山脈抬升在北部形成降雨。' },
            { diff: 'challenge', q: '下列哪一項是「永續發展」的實踐？', options: ['資源回收再利用', '大量使用一次性用品', '濫墾山坡地', '過度捕撈漁獲'], answer: [0], explain: '資源回收可減少浪費，符合永續發展精神。' },
            { diff: 'pro', q: '搭乘大眾運輸、騎自行車或步行通學屬於哪一種做法？', options: ['綠色低碳的交通方式', '浪費時間的活動', '毫無意義的移動', '不需要規畫的行為'], answer: [0], explain: '大眾運輸與步行為低碳出行，可減少碳排放。' },
            // 公民與社會題（供國中分科試卷，dom=civics）
            { diff: 'basic', q: '下列哪一種行為符合公民與社會的規範？', options: ['排隊守秩序', '插隊搶先', '亂丟垃圾', '大聲喧嘩干擾他人'], answer: [0], explain: '排隊守秩序是尊重他人與公共規範的公民行為。' },
            { diff: 'pro', q: '參與公共事務時，下列哪一種方式最能有效表達意見？', options: ['理性溝通並具體提出建議', '謾罵持不同意見者', '散布未經證實的謠言', '拒絕與他人討論'], answer: [0], explain: '理性溝通與具體建議是民主社會參與公共事務的正當方式。' }
        ];
        const multiple = [
            { diff: 'basic', q: '下列哪些是臺灣的古蹟或歷史建築？(可多選)', options: ['赤崁樓', '億載金城', '臺南孔廟', '自由女神像'], answer: [0, 1, 2], explain: '前三項皆為臺灣重要古蹟。' },
            { diff: 'basic', q: '下列哪些是良好的生活習慣？(可多選)', options: ['早睡早起', '飯前洗手', '亂丟垃圾', '按時做功課'], answer: [0, 1, 3], explain: '亂丟垃圾不是好習慣。' },
            { diff: 'pro', q: '下列哪些屬於臺灣的自然災害？(可多選)', options: ['地震', '颱風', '豪雨', '車禍'], answer: [0, 1, 2], explain: '地震、颱風、豪雨屬天然災害；車禍是人為事故。' },
            { diff: 'pro', q: '下列哪些是參與社區事務的方式？(可多選)', options: ['參加社區會議', '擔任志工', '參與環境清掃', '破壞公共設施'], answer: [0, 1, 2], explain: '前三項都是正向的社區參與。' },
            { diff: 'pro', q: '下列哪些是臺灣的特色？(可多選)', options: ['高山密度高', '四面環海', '溫泉資源豐富', '完全沒有地震'], answer: [0, 1, 2], explain: '臺灣地震頻繁，故第 4 項錯誤。' },
            { diff: 'challenge', q: '下列哪些做法有助於環境永續？(可多選)', options: ['資源回收', '節約用水', '使用再生能源', '焚燒塑膠垃圾'], answer: [0, 1, 2], explain: '焚燒塑膠會造成空污，不是永續做法。' },
            { diff: 'challenge', q: '下列哪些因素會影響一個地區的人口分布？(可多選)', options: ['地形', '氣候', '交通', '居民的星座'], answer: [0, 1, 2], explain: '地形、氣候、交通是主要影響因素。' },
            { diff: 'challenge', q: '下列哪些是民主社會中人民應具備的素養？(可多選)', options: ['尊重多元意見', '理性溝通', '遵守法律', '只顧自己利益'], answer: [0, 1, 2], explain: '尊重、理性、守法是公民素養；只顧私利違背公共精神。' },
            // 歷史地理題（未命中公民關鍵字 → 預設 dom=histgeo，供國中分科試卷）
            { diff: 'basic', q: '下列哪些是地圖上常見的圖例符號？(可多選)', options: ['山脈', '河流', '公路', '鉛筆'], answer: [0, 1, 2], explain: '山脈、河流、公路皆為地圖圖例；鉛筆是文具。' },
            { diff: 'pro', q: '下列哪些屬於臺灣的地理特色？(可多選)', options: ['地形多山', '四面環海', '河川短急', '位於赤道'], answer: [0, 1, 2], explain: '臺灣多山、環海、河川短急；臺灣位在北回歸線附近，不在赤道。' }
        ];
        const socTfExtra = [
            { diff: 'basic', q: '我們應該愛護公物，不隨意破壞。', options: ['是', '非'], answer: [0], explain: '公物是大家共用的資源，應共同愛護。' },
            { diff: 'basic', q: '臺灣的官方語言是中文（國語）。', options: ['是', '非'], answer: [0], explain: '臺灣以國語為官方語言，並通用多種母語。' },
            { diff: 'pro', q: '資源回收可以減少垃圾量，也有助於節省資源。', options: ['是', '非'], answer: [0], explain: '回收能再利用資源，減少掩埋與焚燒。' },
            { diff: 'challenge', q: '人口老化是指老年人口比例逐漸下降。', options: ['是', '非'], answer: [1], explain: '人口老化是指老年人口比例上升、年輕人口減少。' }
        ];
        const socSingleExtra = [
            { diff: 'basic', q: '下列哪一項是交通工具？', options: ['公車', '課本', '鉛筆', '水壺'], answer: [0], explain: '公車是交通工具，其餘為文具或用品。' },
            { diff: 'basic', q: '遇到火災時應該撥打哪一個電話號碼？', options: ['119', '110', '165', '104'], answer: [0], explain: '119 是消防與救護專線；110 是警察。' },
            { diff: 'pro', q: '下列哪一項是臺灣的國家公園？', options: ['墾丁國家公園', '中央公園', '大安森林公園', '臺北公園'], answer: [0], explain: '墾丁是臺灣第一座國家公園；其餘為都市公園。' },
            { diff: 'challenge', q: '下列哪一項是臺灣夏季常見的天然災害？', options: ['颱風與豪雨', '沙塵暴', '暴風雪', '冰雹'], answer: [0], explain: '臺灣夏季常有颱風與西南氣流帶來的豪雨。' }
        ];
        const socMulExtra = [
            { diff: 'basic', q: '下列哪些是遵守交通規則的行為？（可多選）', options: ['走行人穿越道', '遵守紅綠燈', '騎車不戴安全帽', '不闖紅燈'], answer: [0, 1, 3], explain: '騎車應戴安全帽，故第 3 項錯誤。' },
            { diff: 'pro', q: '下列哪些是保護環境的做法？（可多選）', options: ['做好垃圾分類', '自備環保餐具', '隨意燃燒廢棄物', '節約能源'], answer: [0, 1, 3], explain: '隨意燃燒廢棄物會造成空氣汙染。' },
            { diff: 'challenge', q: '下列哪些是政府提供的公共服務？（可多選）', options: ['警察治安', '垃圾清運', '國民教育', '私人健身房'], answer: [0, 1, 2], explain: '私人健身房為民營服務，非政府提供。' }
        ];
        const tfAll = expandVariants(tf, 12, socTfExtra);
        const singleAll = expandVariants(single, 12, socSingleExtra);
        const multipleAll = expandVariants(multiple, 12, socMulExtra);
        const tag = arr => arr.map(it => ({ id: nid('social', g, 'x'), zhuyin: low ? zhuyinOf(it.q) : null, ...it, dom: socDom(it.q) }));
        tag(tfAll).forEach(it => push('social', g, 'tf', { ...it, id: nid('social', g, 'tf'), scope: 2 }));
        tag(singleAll).forEach(it => push('social', g, 'single', { ...it, id: nid('social', g, 'single'), scope: 2 }));
        tag(multipleAll).forEach(it => push('social', g, 'multiple', { ...it, id: nid('social', g, 'multiple'), scope: 2 }));
    }
    // 進階社會（S2 / S4），同 buildChinese 的說明。
    advBands.forEach(band => {
        const tfAdv = band.soc.tf.concat(authored('social', band.scope, 'tf'));
        const singleAdv = band.soc.single.concat(authored('social', band.scope, 'single'));
        const multipleAdv = band.soc.multiple.concat(authored('social', band.scope, 'multiple'));
        for (let g = band.from; g <= band.to; g++) {
            const low = g <= 3;
            const tagAdv = (arr) => arr.map(it => ({
                id: nid('social', g, 'x'), zhuyin: low ? zhuyinOf(it.q) : null, scope: band.scope, ...it, dom: socDom(it.q)
            }));
            tagAdv(tfAdv).forEach(it => push('social', g, 'tf', { ...it, id: nid('social', g, 'tf') }));
            tagAdv(singleAdv).forEach(it => push('social', g, 'single', { ...it, id: nid('social', g, 'single') }));
            tagAdv(multipleAdv).forEach(it => push('social', g, 'multiple', { ...it, id: nid('social', g, 'multiple') }));
        }
    });
}

function buildEnglish() {
    for (let g = 2; g <= 10; g++) {
        const tf = [
            { diff: 'basic', q: 'The opposite word of "heavy" is "light".', options: ['True', 'False'], answer: [0], explain: '"Heavy" (重的) and "light" (輕的) are antonyms.' },
            { diff: 'basic', q: '"Cat" is an animal.', options: ['True', 'False'], answer: [0], explain: 'A cat is an animal.' },
            { diff: 'basic', q: '"Apple" is a kind of fruit.', options: ['True', 'False'], answer: [0], explain: 'An apple is a fruit.' },
            { diff: 'basic', q: '"Monday" is a day of the week.', options: ['True', 'False'], answer: [0], explain: 'Monday is the first day of the work week.' },
            { diff: 'pro', q: '"She go to school every day" is grammatically correct.', options: ['True', 'False'], answer: [1], explain: 'It should be "She goes to school every day" (third-person singular).' },
            { diff: 'pro', q: '"Children" is the plural form of "child".', options: ['True', 'False'], answer: [0], explain: 'Child → children is an irregular plural.' },
            { diff: 'pro', q: '"I have went to Japan" is grammatically correct.', options: ['True', 'False'], answer: [1], explain: 'It should be "I have gone to Japan" (past participle).' },
            { diff: 'challenge', q: '"If I were you, I would study harder" uses the subjunctive mood.', options: ['True', 'False'], answer: [0], explain: 'Yes — "were" signals the subjunctive mood for a hypothetical.' }
        ];
        const single = [
            { diff: 'basic', q: 'Choose the correct sentence: "She _____ to school every day."', options: ['walks', 'walk', 'walking', 'walked'], answer: [0], explain: 'Subject "She" takes third-person singular present "walks".' },
            { diff: 'basic', q: 'What color is the sun? (Choose the best answer)', options: ['Yellow', 'Blue', 'Green', 'Purple'], answer: [0], explain: 'The sun is usually described as yellow.' },
            { diff: 'basic', q: 'Which word means "book" in Chinese?', options: ['書', '筆', '桌', '椅'], answer: [0], explain: '"書" means book.' },
            { diff: 'pro', q: 'Choose the correct word: "He has _____ here since 2020."', options: ['lived', 'live', 'living', 'lives'], answer: [0], explain: 'Present perfect uses the past participle "lived".' },
            { diff: 'pro', q: 'Which is the comparative form of "good"?', options: ['better', 'gooder', 'more good', 'best'], answer: [0], explain: 'Good → better → best is irregular.' },
            { diff: 'pro', q: 'Choose the correct sentence (be interested in): "She is _____ in music."', options: ['interested', 'interesting', 'interest', 'interestedly'], answer: [0], explain: '"Be interested in" is the correct collocation.' },
            { diff: 'challenge', q: 'Choose the correct sentence (hardly ... when inversion):', options: ['Hardly had I arrived when it started raining.', 'Hardly I had arrived when it started raining.', 'Hardly had I arrived than it started raining.', 'Hardly I arrived when it started raining.'], answer: [0], explain: 'Negative adverbials trigger inversion: "Hardly had I arrived when...".' },
            { diff: 'challenge', q: 'What does the idiom "break the ice" mean?', options: ['To start a conversation in a social setting', 'To destroy something', 'To feel cold', 'To end a friendship'], answer: [0], explain: '"Break the ice" means to relieve tension and start talking.' }
        ];
        const multiple = [
            { diff: 'basic', q: 'Select all the words that are SYNONYMS of "big".', options: ['Large', 'Huge', 'Enormous', 'Tiny'], answer: [0, 1, 2], explain: 'Large, huge, enormous mean big; tiny means small.' },
            { diff: 'basic', q: 'Select all the colors.', options: ['Red', 'Blue', 'Table', 'Green'], answer: [0, 1, 3], explain: 'Red, blue, green are colors; table is an object.' },
            { diff: 'pro', q: 'Select all the correct past tense forms.', options: ['went', 'ate', 'buyed', 'saw'], answer: [0, 1, 3], explain: 'Buy → bought, not "buyed".' },
            { diff: 'pro', q: 'Select all the words that are verbs.', options: ['run', 'jump', 'happy', 'sing'], answer: [0, 1, 3], explain: 'Run, jump, sing are verbs; happy is an adjective.' },
            { diff: 'pro', q: 'Select all the sentences in the present perfect tense.', options: ['I have finished my homework.', 'She has gone home.', 'They are playing.', 'We have seen that movie.'], answer: [0, 1, 3], explain: 'Present perfect = have/has + past participle.' },
            { diff: 'challenge', q: 'Select all the words that can follow "make" to form a common collocation.', options: ['a decision', 'progress', 'a mistake', 'attention'], answer: [0, 1, 2], explain: '"Make a decision/progress/a mistake"; we say "pay attention".' },
            { diff: 'challenge', q: 'Select all the sentences that use the passive voice.', options: ['The book was written by him.', 'The cake was eaten.', 'She writes a letter.', 'The window has been broken.'], answer: [0, 1, 3], explain: 'Passive = be + past participle; "She writes a letter" is active.' },
            { diff: 'challenge', q: 'Select all the correct conditional sentences.', options: ['If it rains, I will stay home.', 'If I had known, I would have told you.', 'If I was you, I would go.', 'If he will come, I will leave.'], answer: [0, 1], explain: 'Third item should be "If I were you"; fourth should be "If he comes".' }
        ];
        const engTfExtra = [
            { diff: 'basic', q: '"Dog" is a kind of animal.', options: ['True', 'False'], answer: [0], explain: 'A dog is an animal.' },
            { diff: 'basic', q: '"Winter" is a season.', options: ['True', 'False'], answer: [0], explain: 'Winter is one of the four seasons.' },
            { diff: 'pro', q: '"He can sings well" is grammatically correct.', options: ['True', 'False'], answer: [1], explain: 'After "can", use the base verb: "He can sing well".' },
            { diff: 'challenge', q: '"The news are good" is grammatically correct.', options: ['True', 'False'], answer: [1], explain: '"News" is uncountable and takes a singular verb: "The news is good".' }
        ];
        const engSingleExtra = [
            { diff: 'basic', q: 'Choose the correct word: "I have two _____."', options: ['books', 'book', 'bookes', 'bookies'], answer: [0], explain: 'Plural of "book" is "books".' },
            { diff: 'basic', q: 'What is the opposite of "hot"?', options: ['cold', 'warm', 'big', 'fast'], answer: [0], explain: 'Hot ↔ cold.' },
            { diff: 'pro', q: 'Choose the correct sentence (there is/are agreement):', options: ['There are many students in the classroom.', 'There is many students in the classroom.', 'There have many students in the classroom.', 'There has many students in the classroom.'], answer: [0], explain: 'Plural "students" takes "are".' },
            { diff: 'challenge', q: 'Choose the correct sentence (wish + past form):', options: ['I wish I could fly.', 'I wish I can fly.', 'I wish I will fly.', 'I wish I am fly.'], answer: [0], explain: 'After "wish" about the present, use the past form "could".' }
        ];
        const engMulExtra = [
            { diff: 'basic', q: 'Select all the animals.', options: ['dog', 'cat', 'desk', 'bird'], answer: [0, 1, 3], explain: 'Dog, cat, bird are animals; desk is furniture.' },
            { diff: 'pro', q: 'Select all the correct plural forms.', options: ['boxes', 'children', 'foots', 'mice'], answer: [0, 1, 3], explain: 'Foot → feet, not "foots".' },
            { diff: 'challenge', q: 'Select all the sentences that are in the future tense.', options: ['I will call you tomorrow.', 'She is going to travel next week.', 'They played yesterday.', 'We shall meet soon.'], answer: [0, 1, 3], explain: 'The third sentence is past tense.' },
            // 讓 basic 多選有足夠相異內容（expandVariants 的循環填充是同一題文字，
            // 同卷去重會丟掉，導致卷子少一題）。
            { diff: 'basic', q: 'Select all the fruits.', options: ['apple', 'banana', 'chair', 'grape'], answer: [0, 1, 3], explain: 'Chair is furniture, not a fruit.' },
            { diff: 'basic', q: 'Select all the words with a long "a" sound.', options: ['cake', 'rain', 'cat', 'day'], answer: [0, 1, 3], explain: '"Cat" has a short "a" sound.' }
        ];
        const tfAll = expandVariants(tf, 12, engTfExtra);
        const singleAll = expandVariants(single, 12, engSingleExtra);
        const multipleAll = expandVariants(multiple, 12, engMulExtra);
        const tag = arr => arr.map(it => ({ id: nid('english', g, 'x'), zhuyin: null, ...it }));
        tag(tfAll).forEach(it => push('english', g, 'tf', { ...it, id: nid('english', g, 'tf'), scope: 2 }));
        tag(singleAll).forEach(it => push('english', g, 'single', { ...it, id: nid('english', g, 'single'), scope: 2 }));
        tag(multipleAll).forEach(it => push('english', g, 'multiple', { ...it, id: nid('english', g, 'multiple'), scope: 2 }));
    }
    // 進階英語（S2 / S4），同 buildChinese 的說明。
    advBands.forEach(band => {
        const tfAdv = band.eng.tf.concat(authored('english', band.scope, 'tf'));
        const singleAdv = band.eng.single.concat(authored('english', band.scope, 'single'));
        const multipleAdv = band.eng.multiple.concat(authored('english', band.scope, 'multiple'));
        for (let g = band.from; g <= band.to; g++) {
            const low = g <= 3;
            const tagAdv = (arr) => arr.map(it => ({
                id: nid('english', g, 'x'), zhuyin: low ? zhuyinOf(it.q) : null, scope: band.scope, ...it
            }));
            tagAdv(tfAdv).forEach(it => push('english', g, 'tf', { ...it, id: nid('english', g, 'tf') }));
            tagAdv(singleAdv).forEach(it => push('english', g, 'single', { ...it, id: nid('english', g, 'single') }));
            tagAdv(multipleAdv).forEach(it => push('english', g, 'multiple', { ...it, id: nid('english', g, 'multiple') }));
        }
    });
}

mathTpl.buildMath(push, nid);
buildChinese();
buildScience();
buildSocial();
buildEnglish();

// Functions do not survive JSON, so strip the `gen` lambdas but keep the item
// id. The browser rebuilds the generators by re-running the same
// math-templates.js module at load time and matching on id.
Object.values(bank).forEach(subj => Object.values(subj).forEach(g => {
    ['tf', 'single', 'multiple'].forEach(type => {
        (g[type] || []).forEach(it => {
            if (it.tpl) delete it.gen;
        });
    });
}));

writeFileSync('itembank-data.json', JSON.stringify(bank), 'utf8');
const total = Object.values(bank).reduce((a, s) => a + Object.values(s).reduce((b, g) => b + g.tf.length + g.single.length + g.multiple.length, 0), 0);
console.log('items:', total);

export { bank };