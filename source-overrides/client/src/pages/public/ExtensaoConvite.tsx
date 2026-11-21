import ExtensaoAluno from './ExtensaoAluno';
import Login from './Login';

export default function ExtensaoConvite() {
  if (new URLSearchParams(window.location.search).get('aluno') === '1') return <ExtensaoAluno />;

  return <Login institutionalOnly extensionEntry />;
}
