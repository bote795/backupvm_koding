<?php
error_reporting(E_ALL);

ini_set('display_errors', '1');
require_once 'Zend/Mail.php';

$mail=new Zend_Mail();

echo 'it worked';

?>
