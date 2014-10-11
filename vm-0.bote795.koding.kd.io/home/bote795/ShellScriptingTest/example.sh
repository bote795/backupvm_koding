#!/bin/sh
NumberOfExpectedArgs=2
EWRONGARGS=85
scriptParameters="-a -h -m -z"
#		-a = all, -h =help, etc.
if [ $# -ne $NumberOfExpectedArgs ]
then 
	echo "Usage: 'basename $0' $scriptParameters"
	# 'basename $0' is the scripts filename.
	exit $EWRONGARGS
fi
