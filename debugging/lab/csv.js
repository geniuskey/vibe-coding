// CSV 텍스트를 표(행마다 칸의 배열)로 바꾸는 작은 도우미.
// 첫 줄은 머리글이라 건너뛴다.
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.slice(1).map(function (line) {
    return line.split(',');
  });
}

// "980" 같은 글자를 숫자로
function toNumber(value) {
  return parseInt(value, 10);
}
