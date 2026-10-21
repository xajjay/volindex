"""Honors and pro draft picks for the basketball, baseball and softball run games (40-0 / 69-0 ratings).

Seasons are keyed by the year the season ENDS (2007-08 basketball = 2008; baseball/softball = the spring year).
Codes (best honor per type counts):
  NPOY  national player/pitcher of the year      AAC1 consensus or AP first-team All-American
  AA1   first-team All-American (a major selector)  AA2 second team   AA3 third team   AAHM honorable mention
  SPOY  SEC player (or pitcher) of the year      SEC1 / SEC2 / SEC3 All-SEC team      SDPOY SEC defensive player of the year
Sources:
  Men's basketball: 2025-26 Tennessee Men's Basketball Record Book (Honors: All-SEC, SEC awards), Wikipedia yearly
    "NCAA Men's Basketball All-Americans" pages, utsports.com 2026 All-SEC release; NBA draft from Wikipedia yearly draft pages.
  Women's basketball: 2025-26 Lady Vols Media Guide (Lady Vol Honorees: WBCA/Kodak, AP All-America, All-SEC, SEC POY;
    WNBA draft picks), utsports.com 2026 releases (All-SEC, WNBA draft).
  Baseball: 2026 Tennessee Baseball Record Book (All-Americans, SEC honors), utsports.com MLB draft history (2026 update).
  Softball: Tennessee softball record books (All-Americans, SEC honors).
"""

def _expand(text):
    """'Name: 2008 AAC1 SEC1; 2007 AA2' -> {(name, 2008): [...], ...}"""
    out = {}
    for line in text.strip().splitlines():
        line = line.strip()
        if not line or line.startswith('#'): continue
        name, rest = line.split(':', 1)
        for part in rest.split(';'):
            bits = part.split()
            if not bits: continue
            out.setdefault((name.strip(), int(bits[0])), []).extend(bits[1:])
    return out

AWARDS = {}
AWARDS['mbb'] = _expand('''
Allan Houston: 1991 SEC1 AAHM; 1992 SEC1 AA3; 1993 SEC1 AA3
Corey Allen: 1993 SEC2
Steve Hamer: 1995 SEC2; 1996 SEC2
Brandon Wharton: 1997 SEC2; 1998 SEC3; 1999 SEC2
Tony Harris: 1998 SEC2; 1999 SEC2; 2000 SEC1 AAHM
C.J. Black: 1998 SEC2
Vincent Yarbrough: 2000 SEC2 AAHM; 2001 SEC2; 2002 SEC1
Isiah Victor: 2000 SEC3
Ron Slay: 2001 SEC3; 2003 SEC1 SPOY AA3
Marcus Haislip: 2002 SEC2
Scooter McFadgon: 2004 SEC2
C.J. Watson: 2006 SEC2
Chris Lofton: 2006 SEC1 AA2; 2007 SEC1 SPOY AAC2; 2008 SEC1 AAC2
Tyler Smith: 2008 SEC1 AAHM; 2009 SEC1
JaJuan Smith: 2008 SEC2
Wayne Chism: 2009 SEC2; 2010 SEC1
Scotty Hopson: 2011 SEC1
Tobias Harris: 2011 SEC2
Jeronne Maymon: 2012 SEC2
Jordan McRae: 2013 SEC1; 2014 SEC1
Jarnell Stokes: 2013 SEC2; 2014 SEC1
Josh Richardson: 2015 SEC1
Kevin Punter Jr.: 2016 SEC2
Armani Moore: 2016 SEC3
Robert Hubbs III: 2017 SEC2
Grant Williams: 2018 SEC1 SPOY AAHM; 2019 SEC1 SPOY AAC1
Admiral Schofield: 2018 SEC2; 2019 SEC1 AAHM
Jordan Bone: 2019 SEC2
John Fulkerson: 2020 SEC2
Yves Pons: 2020 SDPOY
Kennedy Chandler: 2022 SEC2
Santiago Vescovi: 2022 SEC1; 2023 SEC1
Zakai Zeigler: 2023 SEC2; 2024 SEC1 SDPOY; 2025 SEC1 SDPOY AA3
Dalton Knecht: 2024 SEC1 SPOY AAC1
Jonas Aidoo: 2024 SEC1
Chaz Lanier: 2025 SEC1 AA3
Ja'Kobi Gillespie: 2026 SEC1
Nate Ament: 2026 SEC2
''')
AWARDS['wbb'] = _expand('''
Daedra Charles: 1990 SEC1 AA1; 1991 SEC1 AA1 NPOY
Dena Head: 1990 SEC2; 1991 SEC1; 1992 SEC1 SPOY AA1
Tonya Edwards: 1990 SEC1
Peggy Evans: 1992 SEC1; 1993 SEC2
Lisa Harrison: 1993 SEC1 AA1
Tiffany Woosley: 1993 SEC1; 1994 SEC2
Nikki McCray: 1993 SEC2; 1994 SEC1 SPOY AA1; 1995 SEC1 SPOY AA1
Dana Johnson: 1994 SEC1; 1995 SEC1
Michelle Marciniak: 1995 SEC1; 1996 SEC2 AA2
Latina Davis: 1996 SEC2
Chamique Holdsclaw: 1996 SEC1 AA1; 1997 SEC1 AAC1; 1998 SEC1 SPOY AAC1 NPOY; 1999 SEC1 SPOY AAC1 NPOY
Abby Conklin: 1997 SEC2
Tamika Catchings: 1998 SEC1 AA1; 1999 SEC1 AAC1; 2000 SEC1 AAC1 NPOY; 2001 SEC2 AA2
Semeka Randall: 1998 SEC2; 1999 SEC1 AA2; 2000 SEC1 AA2; 2001 SEC2 AAHM
Kellie Jolly: 1999 SEC2 AAHM
Kara Lawson: 2000 SEC1; 2001 SEC1 AAHM; 2002 SEC1 AA3; 2003 SEC1 AA1
Michelle Snow: 2000 SEC2; 2001 SEC1 AAHM; 2002 SEC2 AAHM
Gwen Jackson: 2001 SEC1 AAHM; 2003 SEC1 AAHM
Kristen Clement: 2001 SEC3
Ashley Robinson: 2001 SEC3
Shyra Ely: 2004 SEC1 AA1; 2005 SEC1
Tasha Butts: 2004 SEC2
Shanna Zolman: 2004 SEC2; 2005 SEC2; 2006 SEC1
Candace Parker: 2006 SEC1 AA1; 2007 SEC1 SPOY AAC1 NPOY; 2008 SEC1 AAC1 NPOY
Alexis Hornbuckle: 2006 SEC2; 2007 SEC1; 2008 SEC1
Sidney Spencer: 2007 SEC2
Shannon Bobbitt: 2008 SEC2 AAHM
Angie Bjorklund: 2009 SEC2; 2010 SEC1 AAHM; 2011 AAHM
Shekinna Stricklen: 2009 SEC2; 2010 SEC2 AAHM; 2011 SEC1 SPOY AA1; 2012 SEC1 AA3
Kelley Cain: 2010 SEC1
Meighan Simmons: 2011 SEC2 AAHM; 2013 SEC1 SPOY AA3; 2014 SEC1 SPOY AAHM
Glory Johnson: 2011 SEC1; 2012 SEC1 AA1 SDPOY
Bashaara Graves: 2013 SEC1; 2016 SEC2 AAHM
Isabelle Harrison: 2014 SEC1 AAHM; 2015 SEC1 AAHM
Cierra Burdick: 2015 SEC1 AAHM
Diamond DeShields: 2016 SEC2; 2017 SEC1
Mercedes Russell: 2017 SEC2 AAHM; 2018 SEC1
Jaime Nared: 2017 SEC2; 2018 SEC1 AAHM
Rennia Davis: 2019 SEC2; 2020 SEC1 AAHM; 2021 SEC1 AAHM
Rae Burrell: 2021 SEC2
Jordan Horston: 2022 SEC1 AAHM; 2023 SEC1 AAHM
Tamari Key: 2022 SEC2
Rickea Jackson: 2023 SEC1 AAHM; 2024 SEC1 AAHM
Talaysia Cooper: 2025 SEC2; 2026 SEC2
''')
AWARDS['baseball'] = _expand('''
Chris Burke: 2000 SEC1 AA1; 2001 SEC1 SPOY AAC1
Jamie Bennett: 2000 SEC2
Jeff Christensen: 2000 SEC2
Jordan Czarniecki: 2003 SEC1
Alex Suarez: 2004 SEC2
Luke Hochevar: 2005 SEC1 SPOY AAC1 NPOY
Chase Headley: 2005 SEC1 AA3
Eli Iorg: 2005 SEC1 AA2
J.P. Arencibia: 2006 SEC1 AA1; 2007 SEC2
Julio Borbon: 2006 SEC2; 2007 SEC2
James Adkins: 2007 SEC2
Kentrail Davis: 2008 SEC2
Yan Gomes: 2008 SEC2
Blake Forsythe: 2009 SEC1
Cody Hawn: 2009 AA2
Drew Steckenrider: 2012 SEC2
Christin Stewart: 2014 SEC1; 2015 SEC1
Nick Senzel: 2016 SEC2 AA1
Jordan Rodgers: 2017 SEC1
Alerick Soularie: 2019 SEC1 AA3
Jake Rucker: 2021 SEC1 AA3
Liam Spence: 2021 SEC1 AA3
Chad Dallas: 2021 AA2
Sean Hunley: 2021 AA2
Chase Dollander: 2022 SEC1 SPOY AAC1
Drew Gilbert: 2022 SEC1 AA1
Trey Lipscomb: 2022 SEC1 AA1
Chase Burns: 2022 SEC2 AA1
Drew Beam: 2022 SEC2 AA2; 2024 AA3
Jorel Ortega: 2022 AA2
Redmond Walsh: 2022 AA2
Ben Joyce: 2022 AA3
Jared Dickey: 2023 SEC2
Andrew Lindsey: 2023 AA3
AJ Russell: 2023 AA3
Christian Moore: 2024 SEC1 AA1
Dylan Dreiling: 2024 SEC1 AA3
Blake Burke: 2024 SEC2 AAC1
Kavares Tears: 2024 SEC2
AJ Causey: 2024 AA3
Liam Doyle: 2025 SEC1 SPOY AAC1 NPOY
Andrew Fischer: 2025 SEC1 AAC1
Gavin Kilen: 2025 SEC1 AA1
Hunter Ensley: 2025 SEC2 AA2
''')
AWARDS['softball'] = {}

# pro drafts: name -> (year, round, overall pick); only picks made while at or after Tennessee
DRAFT = {
    'mbb': {'Allan Houston': (1993, 1, 11), 'Steve Hamer': (1996, 2, 38), 'Marcus Haislip': (2002, 1, 13), 'Vincent Yarbrough': (2002, 2, 33),
            'Tobias Harris': (2011, 1, 19), 'Jarnell Stokes': (2014, 2, 35), 'Jordan McRae': (2014, 2, 58), 'Josh Richardson': (2015, 2, 40),
            'Grant Williams': (2019, 1, 22), 'Admiral Schofield': (2019, 2, 42), 'Jordan Bone': (2019, 2, 57), 'Keon Johnson': (2021, 1, 21),
            'Jaden Springer': (2021, 1, 28), 'Kennedy Chandler': (2022, 2, 38), 'Julian Phillips': (2023, 2, 35), 'Dalton Knecht': (2024, 1, 17),
            'Chaz Lanier': (2025, 2, 37), 'Jahmai Mashack': (2025, 2, 59), 'Nate Ament': (2026, 1, 13), "Ja'Kobi Gillespie": (2026, 2, 42),
            'Felix Okpara': (2026, 2, 46)},
    'wbb': {'Dena Head': (1997, 1, 1), 'Daedra Charles': (1997, 1, 8), 'Chamique Holdsclaw': (1999, 1, 1), 'Lisa Harrison': (1999, 3, 34),
            'Kellie Jolly': (1999, 4, 47), 'Latina Davis': (2000, 4, 50), 'Tamika Catchings': (2001, 1, 3), 'Semeka Randall': (2001, 2, 17),
            'Kristen Clement': (2001, 4, 63), 'Michelle Snow': (2002, 1, 10), 'Kara Lawson': (2003, 1, 5), 'Gwen Jackson': (2003, 1, 6),
            'Ashley Robinson': (2004, 2, 14), 'Tasha Butts': (2004, 2, 20), 'Loree Moore': (2005, 1, 10), 'Shyra Ely': (2005, 2, 14),
            "Tye'sha Fluker": (2006, 1, 10), 'Shanna Zolman': (2006, 2, 16), 'Sidney Spencer': (2007, 2, 25), 'Candace Parker': (2008, 1, 1),
            'Alexis Hornbuckle': (2008, 1, 4), 'Shannon Bobbitt': (2008, 2, 15), 'Nicky Anosike': (2008, 2, 16), 'Alberta Auguste': (2008, 3, 35),
            'Angie Bjorklund': (2011, 2, 17), 'Shekinna Stricklen': (2012, 1, 2), 'Glory Johnson': (2012, 1, 4), 'Kelley Cain': (2012, 1, 7),
            'Vicki Baugh': (2012, 3, 25), 'Kamiko Williams': (2013, 2, 15), 'Meighan Simmons': (2014, 3, 26), 'Isabelle Harrison': (2015, 1, 12),
            'Cierra Burdick': (2015, 2, 14), 'Ariel Massengale': (2015, 3, 29), 'Bashaara Graves': (2016, 2, 22), 'Jordan Reynolds': (2017, 2, 19),
            'Schaquilla Nunn': (2017, 3, 25), 'Diamond DeShields': (2018, 1, 3), 'Jaime Nared': (2018, 2, 13), 'Mercedes Russell': (2018, 2, 22),
            'Rennia Davis': (2021, 1, 9), 'Rae Burrell': (2022, 1, 9), 'Jordan Horston': (2023, 1, 9), 'Rickea Jackson': (2024, 1, 4),
            'Janiah Barker': (2026, 2, 29), 'Zee Spearman': (2026, 3, 0)},
    'baseball': {'Jamie Bennett': (2000, 22, 655), 'John Massey': (2000, 31, 939), 'Chris Burke': (2001, 1, 10), 'Wyatt Allen': (2001, 1, 39),
            'Jeff Christensen': (2001, 5, 155), 'Stevie Daniel': (2001, 6, 193), 'Justin Parker': (2001, 18, 555), 'Brian Gates': (2001, 28, 827),
            'Kris Bennett': (2001, 30, 890), 'Jeffery Terrell': (2002, 31, 926), 'Javi Herrera': (2003, 2, 48), 'Jordan Czarniecki': (2003, 25, 737),
            'Walter Sevilla': (2003, 34, 1002), 'Derek Tharpe': (2004, 6, 187), 'Scot Drucker': (2004, 13, 397), 'Patrick Hicklen': (2004, 16, 475),
            'Brian Cleveland': (2004, 16, 488), 'Eli Iorg': (2005, 1, 38), 'Chase Headley': (2005, 2, 66), 'Josh Alley': (2005, 10, 308),
            'Eric King': (2005, 13, 404), 'Luke Hochevar': (2006, 1, 1), 'Sean Watson': (2006, 2, 52), 'Kelly Edmundson': (2006, 11, 341),
            'Michael Rivera': (2006, 17, 503), 'Deunte Heath': (2006, 19, 580), 'J.P. Arencibia': (2007, 1, 21), 'Julio Borbon': (2007, 1, 35),
            'James Adkins': (2007, 1, 39), 'Chad Maddox': (2007, 13, 408), 'Andy Simunic': (2008, 17, 512), 'Shawn Griffin': (2008, 20, 595),
            'Kentrail Davis': (2009, 1, 39), 'Nick Hernandez': (2009, 12, 377), "Ty'Relle Harris": (2009, 19, 568), 'Danny Wiltz': (2009, 35, 1063),
            'Blake Forsythe': (2010, 3, 89), 'Bryan Morgado': (2010, 4, 141), 'Cody Hawn': (2010, 6, 189),
            'P.J. Polk': (2010, 13, 403), 'Stephen McCray': (2010, 16, 488), 'Steven Gruver': (2011, 7, 238), 'Matt Ramsey': (2011, 19, 600),
            'Matt Duffy': (2011, 20, 610), 'Khayyan Norfork': (2011, 23, 697), 'Charley Thurber': (2011, 39, 1182), 'Drew Steckenrider': (2012, 8, 257),
            'Zack Godley': (2013, 10, 288), 'Will Maddox': (2014, 18, 550), 'Nick Williams': (2014, 26, 767), 'Taylor Smart': (2014, 26, 771),
            'Christin Stewart': (2015, 1, 34), 'Andrew Lee': (2015, 11, 344), 'Drake Owenby': (2015, 12, 361), 'A.J. Simcox': (2015, 14, 430),
            'Bret Marks': (2015, 15, 453), 'Nick Senzel': (2016, 1, 2), 'Andy Cox': (2016, 7, 198), 'Vincent Jackson': (2016, 14, 436),
            'Jordan Rodgers': (2017, 6, 170), 'Kyle Serrano': (2017, 10, 301), 'Zach Warren': (2017, 14, 413), 'Hunter Martin': (2017, 20, 601),
            'Jeff Moberg': (2017, 30, 869), 'Benito Santiago': (2018, 34, 1023), 'Andre Lipcius': (2019, 3, 83), 'Garrett Stallings': (2019, 5, 151),
            'Andrew Schultz': (2019, 6, 180), 'Zach Linginfelter': (2019, 9, 271), 'Ricky Martinez': (2019, 18, 542), 'Jay Charleston': (2019, 26, 769),
            'Garrett Crochet': (2020, 1, 11), 'Alerick Soularie': (2020, 2, 59), 'Zach Daniels': (2020, 4, 131), 'Chad Dallas': (2021, 4, 121),
            'Liam Spence': (2021, 5, 154), 'Max Ferguson': (2021, 5, 160), 'Connor Pavolony': (2021, 7, 197), 'Jake Rucker': (2021, 7, 219),
            'Jackson Leath': (2021, 12, 344), 'Sean Hunley': (2021, 19, 581), 'Drew Gilbert': (2022, 1, 28), 'Jordan Beck': (2022, 1, 38),
            'Blade Tidwell': (2022, 2, 52), 'Trey Lipscomb': (2022, 3, 84), 'Ben Joyce': (2022, 3, 89), 'Will Mabrey': (2022, 6, 168),
            'Jorel Ortega': (2022, 6, 174), 'Seth Stephenson': (2022, 7, 207), 'Mark McLaughlin': (2022, 7, 222), 'Cortland Lawson': (2022, 14, 411),
            'Chase Dollander': (2023, 1, 9), 'Maui Ahuna': (2023, 4, 117), 'Andrew Lindsey': (2023, 5, 146), 'Seth Halvorsen': (2023, 7, 202),
            'Jared Dickey': (2023, 11, 319), 'Zach Joyce': (2023, 14, 414), 'Jake Fitzgibbons': (2023, 14, 415), 'Bryce Jenkins': (2023, 17, 516),
            'Christian Moore': (2024, 1, 8), 'Blake Burke': (2024, 1, 34), 'Billy Amick': (2024, 2, 60), 'Dylan Dreiling': (2024, 2, 65),
            'Drew Beam': (2024, 3, 76), 'Kavares Tears': (2024, 4, 134), 'AJ Causey': (2024, 5, 138), 'Aaron Combs': (2024, 8, 229),
            'Liam Doyle': (2025, 1, 5), 'Gavin Kilen': (2025, 1, 13), 'Andrew Fischer': (2025, 1, 20), 'Marcus Phillips': (2025, 1, 33),
            'AJ Russell': (2025, 2, 52), 'Dean Curley': (2025, 2, 64), 'Tanner Franklin': (2025, 2, 72), 'Nate Snead': (2025, 3, 105),
            'Cannon Peebles': (2025, 17, 522), 'Tegan Kuhns': (2026, 1, 32), 'Henry Ford': (2026, 6, 191), 'Bo Rhudy': (2026, 7, 219),
            'Garrett Wright': (2026, 8, 229), 'Brandon Arvidson': (2026, 12, 367), 'Evan Blanco': (2026, 13, 381)},
    'softball': {},
}
LEGENDS = {'wbb': {'Chamique Holdsclaw', 'Candace Parker'}, 'softball': {'Monica Abbott'}}
