#!/bin/bash
ns=i"node=omzgrid124&nodenum=1&vip=omzgrid124vip&status=Active&type=Unpinned&node=omzgrid125&nodenum=2&vip=omzgrid125vip&status=Active&type=Unpinned"
IFS='//&node=' read -a dnsservers <<< "${ns}"

for i in "${dnsservers[@]}"
do
   echo "$i"
done
