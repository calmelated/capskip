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

function push(subject, grade, type, item) {
    bank[subject] ??= {};
    bank[subject][grade] ??= { tf: [], single: [], multiple: [] };
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

// ---------------------------------------------------------------- CHINESE
// Hand-authored sets per band. `zyMap` gives per-character zhuyin for grades 2-3.
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
            { diff: 'challenge', q: '下列哪些屬於「摹寫」修辭？(可多選)', options: ['視覺摹寫', '聽覺摹寫', '嗅覺摹寫', '誇張摹寫'], answer: [0, 1, 2], explain: '摹寫分為視覺、聽覺、嗅覺、味覺、觸覺，「誇張摹寫」不是分類。' }
        ];
        const tfAll = expandVariants(tf, 12, tfExtra);
        const singleAll = expandVariants(single, 12, singleExtra);
        const multipleAll = expandVariants(multiple, 12, multipleExtra);

        const tagZy = (arr) => arr.map(it => ({
            id: nid('chinese', g, 'x'),
            zhuyin: low ? zhuyinOf(it.q) : null,
            ...it
        }));
        tagZy(tfAll).forEach(it => push('chinese', g, 'tf', { ...it, id: nid('chinese', g, 'tf') }));
        tagZy(singleAll).forEach(it => push('chinese', g, 'single', { ...it, id: nid('chinese', g, 'single') }));
        tagZy(multipleAll).forEach(it => push('chinese', g, 'multiple', { ...it, id: nid('chinese', g, 'multiple') }));
    }
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

    for (let g = 2; g <= 9; g++) {
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
        tag(tfAll).forEach(it => push('science', g, 'tf', { ...it, id: nid('science', g, 'tf') }));
        tag(singleAll).forEach(it => push('science', g, 'single', { ...it, id: nid('science', g, 'single') }));
        tag(multipleAll).forEach(it => push('science', g, 'multiple', { ...it, id: nid('science', g, 'multiple') }));
    }
}

function buildSocial() {
    for (let g = 2; g <= 9; g++) {
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
        tag(tfAll).forEach(it => push('social', g, 'tf', { ...it, id: nid('social', g, 'tf') }));
        tag(singleAll).forEach(it => push('social', g, 'single', { ...it, id: nid('social', g, 'single') }));
        tag(multipleAll).forEach(it => push('social', g, 'multiple', { ...it, id: nid('social', g, 'multiple') }));
    }
}

function buildEnglish() {
    for (let g = 2; g <= 9; g++) {
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
            { diff: 'pro', q: 'Choose the correct sentence.', options: ['I am interested in music.', 'I am interesting in music.', 'I am interest in music.', 'I am interested on music.'], answer: [0], explain: '"Be interested in" is the correct collocation.' },
            { diff: 'challenge', q: 'Choose the correct sentence.', options: ['Hardly had I arrived when it started raining.', 'Hardly I had arrived when it started raining.', 'Hardly had I arrived than it started raining.', 'Hardly I arrived when it started raining.'], answer: [0], explain: 'Negative adverbials trigger inversion: "Hardly had I arrived when...".' },
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
            { diff: 'pro', q: 'Choose the correct sentence.', options: ['There are many students in the classroom.', 'There is many students in the classroom.', 'There have many students in the classroom.', 'There has many students in the classroom.'], answer: [0], explain: 'Plural "students" takes "are".' },
            { diff: 'challenge', q: 'Choose the correct sentence.', options: ['I wish I could fly.', 'I wish I can fly.', 'I wish I will fly.', 'I wish I am fly.'], answer: [0], explain: 'After "wish" about the present, use the past form "could".' }
        ];
        const engMulExtra = [
            { diff: 'basic', q: 'Select all the animals.', options: ['dog', 'cat', 'desk', 'bird'], answer: [0, 1, 3], explain: 'Dog, cat, bird are animals; desk is furniture.' },
            { diff: 'pro', q: 'Select all the correct plural forms.', options: ['boxes', 'children', 'foots', 'mice'], answer: [0, 1, 3], explain: 'Foot → feet, not "foots".' },
            { diff: 'challenge', q: 'Select all the sentences that are in the future tense.', options: ['I will call you tomorrow.', 'She is going to travel next week.', 'They played yesterday.', 'We shall meet soon.'], answer: [0, 1, 3], explain: 'The third sentence is past tense.' }
        ];
        const tfAll = expandVariants(tf, 12, engTfExtra);
        const singleAll = expandVariants(single, 12, engSingleExtra);
        const multipleAll = expandVariants(multiple, 12, engMulExtra);
        const tag = arr => arr.map(it => ({ id: nid('english', g, 'x'), zhuyin: null, ...it }));
        tag(tfAll).forEach(it => push('english', g, 'tf', { ...it, id: nid('english', g, 'tf') }));
        tag(singleAll).forEach(it => push('english', g, 'single', { ...it, id: nid('english', g, 'single') }));
        tag(multipleAll).forEach(it => push('english', g, 'multiple', { ...it, id: nid('english', g, 'multiple') }));
    }
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