import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).parents[1] / 'enamed' / 'compare_full_items.py'
spec = importlib.util.spec_from_file_location('full_items', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FullItemComparisonTests(unittest.TestCase):
    def test_preserves_clinically_material_numbers_and_symbols(self):
        for official, stored in [('Dose 1,5 mg', 'Dose 15 mg'), ('−3 mEq/L', '3 mEq/L'),
                                 ('SpO2 90%', 'SpO2 99%'), ('0,5 mg', '0.5 mg')]:
            result = module.compare(official, stored)
            self.assertFalse(result['token_equivalent'])
            self.assertFalse(result['numeric_sequence_equal'])

    def test_units_negations_and_final_command_are_compared(self):
        for official, stored in [('10 mg', '10 g'), ('não indicar', 'indicar'),
                                 ('Paciente estável. Qual exame inicial?', 'Paciente estável. Qual exame definitivo?')]:
            self.assertFalse(module.compare(official, stored)['token_equivalent'])

    def test_whitespace_alone_does_not_hide_real_changes(self):
        self.assertTrue(module.compare('Paciente\n estável', 'Paciente estável')['token_equivalent'])
        self.assertFalse(module.compare('Paciente\n instável', 'Paciente estável')['token_equivalent'])


if __name__ == '__main__':
    unittest.main()
