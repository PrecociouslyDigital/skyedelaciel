// Written in js so config can use it too
export const formats = {
    youtube: /^https:\/\/(www\.)?(youtube\.com\/watch\?|you\.tube\/)/g,
    doi: /^https:\/\/(dx\.)?(www\.)?doi.org\//g,
    isbn: /^https:\/\/(www\.)?openlibrary.org\/isbn\//g,
    wikipedia: /^https?:\/\/(en\.)?(www\.)?wikipedia.org\//g,
};