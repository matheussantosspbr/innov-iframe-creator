-- O usuário app precisa criar e apagar o banco sombra que o `prisma migrate dev` usa.
GRANT ALL PRIVILEGES ON *.* TO 'app'@'%';
FLUSH PRIVILEGES;
