#!/bin/bash

 

STR="node=omzgrid124&nodenum=1&vip=omzgrid124vip&status=Active&type=Unpinned&node=omzgrid125&nodenum=2&vip=omzgrid125vip&status=Active&type=Unpinned"

 

STR_ARRAY=(`echo $STR | tr "\\&node=" "\n"`)

 

for x in "${STR_ARRAY[@]}"

do

    echo "> [$x]"

done
