# MaiaOS Shell grammar file-input smoke test
name=Maia
echo "Hello, $name"
mkdir demo
cd demo
echo ready > status.txt
cat status.txt
false || echo recovered