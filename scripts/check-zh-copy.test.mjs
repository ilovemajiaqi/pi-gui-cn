import assert from "node:assert/strict";
import { test } from "node:test";
import { checkZhCopy, zhCopyErrors } from "./check-zh-copy.mjs";

test("half-width marks between Chinese characters are punctuation typos", () => {
  const errors = zhCopyErrors([{ key: "a.b", value: "选择一个节点,从该处新建分支。" }]);
  assert.match(errors[0], /use "，"/);
  for (const [value, full] of [
    ["错误:", "："],
    ["已发布(当前版本)", "（"],
    ["完成?", "？"],
    ["注意!", "！"],
  ]) {
    assert.match(zhCopyErrors([{ key: "a.b", value }])[0], new RegExp(`use "${full}"`));
  }
});

test("half-width marks inside a literal are left alone", () => {
  for (const value of [
    "在 {path} 中，运行 `pi --api-key,x`。",
    "模型 id: gpt-4,1 见文档。",
    "访问 https://example.com, 然后重试。",
    "版本 1.2.3 保持半角。",
    "OAuth (protocol) 保留原文。",
  ]) {
    assert.deepEqual(zhCopyErrors([{ key: "a.b", value }]), [], value);
  }
});

test("the ellipsis is one character, not three periods", () => {
  assert.match(
    zhCopyErrors([{ key: "a.b", value: "正在加载..." }])[0],
    /use the single ellipsis character/,
  );
  assert.deepEqual(zhCopyErrors([{ key: "a.b", value: "正在加载…" }]), []);
});

test("a sentence period between Chinese characters must be full width", () => {
  for (const value of ["已完成.", "请稍等. 然后重试"]) {
    assert.match(zhCopyErrors([{ key: "a.b", value }])[0], /use "。"/, value);
  }
});

test("a dot that starts a file extension is not a sentence period", () => {
  for (const value of [
    "粘贴的图片.png",
    "已保存为报告.md",
    "选择 config.json 后继续。",
    "版本 1.2.3 保持半角。",
  ]) {
    assert.deepEqual(zhCopyErrors([{ key: "a.b", value }]), [], value);
  }
});

test("the real Chinese catalog passes", () => assert.deepEqual(checkZhCopy(process.cwd()), []));
