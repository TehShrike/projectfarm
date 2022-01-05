npm i
npm run build
mkdir -p docs
cp -r public/* docs/
git add docs
git commit -m "auto-build"
git push upstream pages
