# ローカルリポジトリのファイルを置き換え
cp ~/Downloads/page.tsx mogukuma-diet/src/app/page.tsx
# または app/ フォルダ直下の場合
cp ~/Downloads/page.tsx mogukuma-diet/app/page.tsx

# GitHubにプッシュ
cd mogukuma-diet
git add app/page.tsx
git commit -m "fix: page.tsx の重複・混在コードを完全修正"
git push
