export const formats : {
    [key in Format]: RegExp;
}
declare type Format = 'youtube' | 'doi' | 'isbn' | 'wikipedia';