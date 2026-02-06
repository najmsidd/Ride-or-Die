window.Summarizer = (function() {
    function getSentences(text) {
        // Better sentence splitting that handles abbreviations
        const sentences = text.match(/[^\.!\?]+[\.!\?]+(?:\s|$)/g) || [];
        return sentences.map(s => s.trim()).filter(s => s.length > 20 && s.split(' ').length > 5);
    }
    
    function getTokens(sentence) {
        return sentence.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !isStopWord(w));
    }
    
    function isStopWord(word) {
        const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were', 'said', 'their', 'would', 'there', 'could', 'which', 'about', 'other', 'than', 'then', 'these', 'some', 'into', 'only', 'over', 'just', 'also', 'very', 'when', 'much', 'even', 'most', 'such', 'more']);
        return stopWords.has(word);
    }
    
    function calculateSimilarity(sentA, sentB) {
        const tokensA = new Set(getTokens(sentA));
        const tokensB = new Set(getTokens(sentB));
        let intersection = 0;
        tokensA.forEach(t => { if(tokensB.has(t)) intersection++; });
        const union = tokensA.size + tokensB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    function scoreSentenceQuality(sentence, allSentences) {
        let score = 1.0;
        const words = sentence.split(/\s+/);
        const length = words.length;
        
        // Prefer medium-length sentences (15-30 words)
        if (length >= 15 && length <= 30) score += 0.3;
        else if (length < 10 || length > 40) score -= 0.2;
        
        // Boost sentences with numbers/data
        if (/\d+/.test(sentence)) score += 0.15;
        
        // Penalize questions heavily
        if (sentence.trim().endsWith('?')) score -= 0.4;
        
        // Boost sentences with key indicator words
        if (/\b(important|significant|concluded|found|discovered|shows|indicates|researchers|study|results)\b/i.test(sentence)) {
            score += 0.25;
        }
        
        // Penalize very short or very long sentences more aggressively
        if (length < 8) score -= 0.5;
        if (length > 50) score -= 0.3;
        
        return Math.max(0, score);
    }

    function generate(text, numSentences) {
        const sentences = getSentences(text);
        if (sentences.length === 0) return "No suitable content found for summarization.";
        
        // Much more aggressive scaling - up to 2x for long summaries, allow up to 60% of document
        const scaleFactor = numSentences >= 15 ? 2.0 : (numSentences >= 10 ? 1.7 : 1.3);
        const actualNum = Math.max(3, Math.min(Math.floor(numSentences * scaleFactor), Math.floor(sentences.length * 0.6)));
        
        if (sentences.length <= actualNum) {
            return sentences.map(s => `• ${s}`).join("\n\n");
        }
        
        // Initialize scores with quality heuristics
        const scores = sentences.map((s, i) => {
            let baseScore = scoreSentenceQuality(s, sentences);
            // Boost first few sentences slightly (intro often important)
            if (i < 3) baseScore += 0.1;
            return baseScore;
        });
        
        // Build similarity graph
        const graph = [];
        for (let i = 0; i < sentences.length; i++) {
            graph[i] = [];
            for (let j = 0; j < sentences.length; j++) {
                if (i !== j) {
                    const sim = calculateSimilarity(sentences[i], sentences[j]);
                    if (sim > 0.1) graph[i].push({ idx: j, weight: sim });
                }
            }
        }
        
        // TextRank algorithm with more iterations
        for (let iter = 0; iter < 10; iter++) {
            const newScores = [...scores];
            for (let i = 0; i < sentences.length; i++) {
                let sum = 0;
                for (let j = 0; j < sentences.length; j++) {
                    const edge = graph[j].find(e => e.idx === i);
                    if (edge) {
                        const outWeight = graph[j].reduce((acc, e) => acc + e.weight, 0);
                        sum += (scores[j] * edge.weight) / outWeight;
                    }
                }
                newScores[i] = 0.15 + 0.85 * sum;
            }
            scores.forEach((_, k) => scores[k] = newScores[k]);
        }
        
        // Rank and select top sentences
        const ranked = sentences.map((text, idx) => ({ text: text.trim(), score: scores[idx], idx }));
        ranked.sort((a, b) => b.score - a.score);
        
        // Select top N, ensuring diversity
        const selected = [];
        const used = new Set();
        
        for (const item of ranked) {
            if (selected.length >= actualNum) break;
            
            // Check if too similar to already selected
            const tooSimilar = selected.some(s => 
                calculateSimilarity(item.text, s.text) > 0.6
            );
            
            if (!tooSimilar && !used.has(item.idx)) {
                selected.push(item);
                used.add(item.idx);
            }
        }
        
        // Sort by original order
        selected.sort((a, b) => a.idx - b.idx);
        
        return selected.map(s => `• ${s.text}`).join("\n\n");
    }
    
    return { generate };
})();