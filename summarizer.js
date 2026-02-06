
window.Summarizer = (function() {
    function getSentences(text) { return text.match(/[^\.!\?]+[\.!\?]+/g) || [text]; }
    function getTokens(sentence) { return sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3); }
    function calculateSimilarity(sentA, sentB) {
        const tokensA = new Set(getTokens(sentA));
        const tokensB = new Set(getTokens(sentB));
        let intersection = 0;
        tokensA.forEach(t => { if(tokensB.has(t)) intersection++; });
        const union = tokensA.size + tokensB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    function generate(text, numSentences) {
        const sentences = getSentences(text);
        if (sentences.length <= numSentences) return sentences.join(" ");
        const scores = new Array(sentences.length).fill(1.0);
        const graph = [];
        for (let i = 0; i < sentences.length; i++) {
            graph[i] = [];
            for (let j = 0; j < sentences.length; j++) {
                if (i !== j && calculateSimilarity(sentences[i], sentences[j]) > 0) graph[i].push(j);
            }
        }
        for (let iter = 0; iter < 5; iter++) {
            const newScores = [...scores];
            for (let i = 0; i < sentences.length; i++) {
                let sum = 0;
                for (let j = 0; j < sentences.length; j++) if (graph[j].includes(i)) sum += scores[j] / graph[j].length;
                newScores[i] = 0.15 + 0.85 * sum;
            }
            scores.forEach((_, k) => scores[k] = newScores[k]);
        }
        const ranked = sentences.map((t, i) => ({ text: t.trim(), score: scores[i], idx: i }));
        ranked.sort((a, b) => b.score - a.score);
        const top = ranked.slice(0, numSentences);
        top.sort((a, b) => a.idx - b.idx);
        return top.map(s => `• ${s.text}`).join("\n\n");
    }
    return { generate };
})();