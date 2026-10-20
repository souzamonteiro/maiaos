name=value
if true; then echo yes; else echo no; fi
for item in a b; do echo $item; done
while false; do echo loop; done
(echo sub; pwd)
echo abc | cat && echo ok
echo output >> result.txt