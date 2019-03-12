/** Note Amazon Transcribe data shape doesn't work with the generic generateEntitiesRanges module so we are creating on inline here **/
import generateEntitiesRanges from '../generate-entities-ranges/index.js';


/**
 * Helper function to generate draft.js entities,
 * see unit test for example data structure
 * it adds offset and length to recognise word in draftjs
 */

/**
 *  @param {json} words  - List of words
 *  @param {string} wordAttributeName - eg 'punct' or 'text' or etc.
 * attribute for the word object containing the text. eg word ={ punct:'helo', ... }
 *  or eg word ={ text:'helo', ... }
 */

const getBestAlternativeForWord = (word) => {
  const alternatives = word.alternatives;
  //return alternatives.reduce();
  return word.alternatives[0].content
}

/**
Normalizes words so they can be used in
 the generic amazonTranscribeToDraft() method
**/

const normalizedWord = (currentWord, previousWord) => {
  return {
    start: /punctuation/.test(currentWord.type) ? parseFloat(previousWord.end_time) + 0.05 : parseFloat(currentWord.start_time),
    end: /punctuation/.test(currentWord.type) ? parseFloat(previousWord.start_time) + 0.06 : parseFloat(currentWord.end_time),
    text: getBestAlternativeForWord(currentWord)
  }
}

const _generateEntitiesRanges = (words, wordAttributeName) => {
  let position = 0;
  return words.map((word, index) => {
    const content = word.alternatives[0].content;
    const result = {
      /**Amazon Transcribe punctuation does not have a start or end time
       so set it to the previous word start end time (with a little extra time) if punctuation **/
      start: /punctuation/.test(word.type) ? parseFloat(words[index - 1].end_time) + 0.05 : parseFloat(word.start_time),
      end: /punctuation/.test(word.type) ? parseFloat(words[index - 1].start_time) + 0.06 : parseFloat(word.end_time),
      confidence: parseFloat(word.alternatives[0].confidence),
      text: content,
      offset: parseFloat(position),
      length: content.length,
      key: Math.random()
        .toString(36)
        .substring(6),
    };
    // increase position counter - to determine word offset in paragraph
    position = position + content.length + 1;

    return result;
  });
};


/**
 * groups words list from kaldi transcript based on punctuation.
 * @todo To be more accurate, should introduce an honorifics library to do the splitting of the words.
 * @param {array} words - array of words opbjects from kaldi transcript
 */

const groupWordsInParagraphs = (words) => {
  const results = [];
  let paragraph = {
    words: [],
    text: []
  };

  words.forEach((word, index) => {
    // if word type is punctuation
    const content = word.alternatives[0].content;
    let previousWord = {};
    if (word.type === 'punctuation' && /[.?!]/.test(content)) {
      previousWord = words[index-1]; //assuming here the very first word is never punctuation
      paragraph.words.push(normalizedWord(word, previousWord));
      paragraph.text.push(content);
      results.push(paragraph);
      // reset paragraph
      paragraph = {
        words: [],
        text: []
      };
    } else {
      paragraph.words.push(normalizedWord(word, previousWord));
      paragraph.text.push(content);
    }
  });

  return results;
};

const amazonTranscribeToDraft = (amazonTranscribeJson) => {
  const results = [];
  let tmpWords;

  // BBC Octo Labs API Response wraps Kaldi response around retval,
  // while kaldi contains word attribute at root
  if (amazonTranscribeJson.retval !== undefined) {
    tmpWords = amazonTranscribeJson.retval.words;
  } else {
    tmpWords = amazonTranscribeJson.results.items;
  }

  const wordsByParagraphs = groupWordsInParagraphs(tmpWords);
  //debugger;
  wordsByParagraphs.forEach((paragraph, i) => {
    const draftJsContentBlockParagraph = {
      text: paragraph.text.join(' '),
      type: 'paragraph',
      data: {
        speaker: `TBC ${ i }`,
        words: paragraph.words,
        start: parseFloat(paragraph.words[0].start_time)
      },
      // the entities as ranges are each word in the space-joined text,
      // so it needs to be compute for each the offset from the beginning of the paragraph and the length
      entityRanges: generateEntitiesRanges(paragraph.words, 'text'), // wordAttributeName
    };
    // console.log(JSON.stringify(draftJsContentBlockParagraph,null,2))
    results.push(draftJsContentBlockParagraph);
  });
  return results;
};

export default amazonTranscribeToDraft;
