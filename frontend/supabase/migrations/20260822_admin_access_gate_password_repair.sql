-- Repara o verificador inicial do acesso reforçado com um hash bcrypt compatível com extensions.crypt.
insert into public.endoacolhe_admin_access_gate (singleton, password_hash)
values (true, '$2a$12$p5b.Z2EfheFBHZt6XqoScOX9ABtSsvmYtM3FnrnqlSc/VG15vSfr.')
on conflict (singleton) do update
set password_hash = excluded.password_hash,
    updated_at = now();
