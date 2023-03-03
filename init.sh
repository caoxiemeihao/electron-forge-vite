npm i -g electron-forge-template-vite-typescript

cd ..
rm -rf test-forge-vite-typescript
mkdir test-forge-vite-typescript
cd test-forge-vite-typescript

yarn create electron-app --template=vite-typescript

# ---------------------------------------------------

rm -rf test-forge-webpack-typescript
mkdir test-forge-webpack-typescript
cd test-forge-webpack-typescript

yarn create electron-app --template=webpack-typescript
